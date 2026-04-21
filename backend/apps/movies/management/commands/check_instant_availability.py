import asyncio

from apps.integrations.realdebrid import RealDebridClient
from apps.movies.models import TorrentRelease
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = 'Verifica disponibilidade instantânea (cached) de torrents no Real-Debrid'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            required=True,
            help='Username do usuário com Real-Debrid configurado'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Número de releases para verificar (default: 100)'
        )
    
    def handle(self, *args, **options):
        username = options['user']
        limit = options['limit']
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'✗ Usuário {username} não encontrado')
            )
            return
        
        if not user.realdebrid_api_key:
            self.stdout.write(
                self.style.ERROR('✗ Real-Debrid não configurado para este usuário')
            )
            return
        
        # Get releases not yet checked (or old checks)
        releases = TorrentRelease.objects.filter(
            instantly_available=False
        )[:limit]
        
        self.stdout.write(f"Verificando {releases.count()} releases...")
        
        # Check in batches of 100 (RD API limit)
        batch_size = 100
        total_available = 0
        
        async def check_batch(batch):
            hashes = [r.info_hash for r in batch]
            
            client = RealDebridClient(user.realdebrid_api_key)
            try:
                availability = await client.check_instant_availability(hashes)
                return availability
            finally:
                await client.close()
        
        for i in range(0, len(releases), batch_size):
            batch = releases[i:i+batch_size]
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            availability = loop.run_until_complete(check_batch(batch))
            loop.close()
            
            # Update releases
            for release in batch:
                is_available = availability.get(release.info_hash.upper(), False)
                
                if is_available:
                    release.instantly_available = True
                    release.instant_check_at = timezone.now()
                    release.save()
                    total_available += 1
                    
                    self.stdout.write(f"  ✓ {release.title[:60]}")
            
            self.stdout.write(f"Batch {i//batch_size + 1}: {len(batch)} releases verificados")
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Total: {releases.count()} verificados, {total_available} disponíveis instantaneamente"
            )
        )


# Uso:
# python manage.py check_instant_availability --user admin --limit 500