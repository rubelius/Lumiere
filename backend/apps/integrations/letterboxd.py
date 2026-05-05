import re
import logging
from datetime import datetime
from typing import Dict, List, Any

import feedparser
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class LetterboxdClient:
    """
    Cliente para scraping do Letterboxd
    
    IMPORTANTE: Letterboxd não tem API pública oficial.
    Usamos RSS feeds e web scraping ético.
    """
    
    BASE_URL = "https://letterboxd.com"
    
    def __init__(self, username: str):
        self.username = username
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; Lumiere/1.0; +https://lumiere.app)'
            }
        )
    
    async def get_diary_entries(self, limit: int = 100) -> List[Dict]:
        """
        Busca entradas do diário via RSS feed
        """
        feed_url = f"{self.BASE_URL}/{self.username}/rss"
        
        try:
            response = await self.client.get(feed_url)
            response.raise_for_status()
            
            feed = feedparser.parse(response.text)
            entries = []
            
            for entry in feed.entries[:limit]:
                # Casting explícito para string para acalmar o Pylance
                desc_str = str(entry.get('description', ''))
                soup = BeautifulSoup(desc_str, 'html.parser')
                
                # ISSUE 3: Correção do parsing de Rating (Half-stars)
                rating = None
                
                # 1. Forma mais robusta: O feedparser extrai a tag customizada
                if hasattr(entry, 'letterboxd_memberrating'):
                    try:
                        rating = float(str(entry.letterboxd_memberrating))
                    except (ValueError, TypeError):
                        pass
                
                # 2. Fallback: Contar as estrelas do título da entrada
                title_str = str(entry.get('title', ''))
                if rating is None and ' - ' in title_str:
                    stars_str = title_str.split(' - ')[-1]
                    if '★' in stars_str or '½' in stars_str:
                        rating = stars_str.count('★') * 1.0 + stars_str.count('½') * 0.5
                
                # Extract review text
                review = ''
                review_elem = soup.find('p')
                if review_elem:
                    review = review_elem.get_text(strip=True)
                
                # Parse film info from title
                title_parts = title_str.split(' - ')
                film_info = str(title_parts[0]) if title_parts else title_str
                
                # Extract year
                year_match = re.search(r', (\d{4})', film_info)
                year = int(year_match.group(1)) if year_match else None
                film_name = re.sub(r', \d{4}$', '', film_info) if year else film_info
                
                # Date parsing com tipagem segura
                pub_parsed: Any = entry.get('published_parsed')
                watched_date = datetime(*tuple(pub_parsed)[:6]).date() if pub_parsed else None
                
                entries.append({
                    'entry_id': str(entry.get('id', '')),
                    'film_name': film_name,
                    'film_year': year,
                    'watched_date': watched_date,
                    'rating': rating,
                    'review': review,
                    'link': str(entry.get('link', '')),
                    'rewatch': 'Rewatched' in desc_str,
                    'like': '♥' in desc_str,
                })
            
            return entries
        
        except httpx.HTTPError as e:
            # ISSUE 2: Tratamento de erros decente em vez de falha silenciosa
            logger.error(f"HTTP Error fetching Letterboxd diary for {self.username}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error fetching Letterboxd diary for {self.username}: {e}")
            raise
    
    async def get_lists(self) -> List[Dict]:
        """
        Busca listas públicas do usuário via scraping
        """
        try:
            response = await self.client.get(f"{self.BASE_URL}/{self.username}/lists")
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            lists = []
            
            for list_item in soup.find_all('div', class_='list-set'):
                title_elem = list_item.find('h2', class_='title')
                if not title_elem:
                    continue
                
                link_elem = title_elem.find('a')
                if not link_elem:
                    continue
                
                # Film count
                count_elem = list_item.find('small', class_='value')
                film_count = 0
                if count_elem:
                    count_text = count_elem.get_text(strip=True)
                    count_match = re.search(r'(\d+)', count_text)
                    if count_match:
                        film_count = int(count_match.group(1))
                
                # Description
                desc_elem = list_item.find('div', class_='body-text')
                description = desc_elem.get_text(strip=True) if desc_elem else ''
                
                # Type casting no href para evitar erro de concatenação
                href_val = str(link_elem.get('href', ''))
                
                lists.append({
                    'name': link_elem.get_text(strip=True),
                    'url': self.BASE_URL + href_val,
                    'list_id': href_val.strip('/'),
                    'film_count': film_count,
                    'description': description,
                })
            
            return lists
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP Error fetching Letterboxd lists for {self.username}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error fetching Letterboxd lists for {self.username}: {e}")
            raise
    
    async def get_list_films(self, list_url: str) -> List[Dict]:
        """
        Busca filmes de uma lista específica
        """
        try:
            response = await self.client.get(list_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            films = []
            
            # Find all film posters
            for idx, poster in enumerate(soup.find_all('div', class_='film-poster'), 1):
                img = poster.find('img')
                if not img:
                    continue
                
                film_name = str(img.get('alt', ''))
                
                # Try to extract year from data attributes
                film_link = poster.find('a')
                year = None
                slug = None
                
                if film_link and 'data-film-slug' in film_link.attrs:
                    slug = str(film_link['data-film-slug'])
                    year_match = re.search(r'-(\d{4})$', slug)
                    if year_match:
                        year = int(year_match.group(1))
                
                films.append({
                    'position': idx,
                    'film_name': film_name,
                    'film_year': year,
                    'letterboxd_slug': slug,
                })
            
            return films
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP Error fetching list films from {list_url}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error fetching list films from {list_url}: {e}")
            raise
    
    async def get_watchlist(self) -> List[Dict]:
        """
        Busca watchlist do usuário
        """
        watchlist_url = f"{self.BASE_URL}/{self.username}/watchlist"
        return await self.get_list_films(watchlist_url)
    
    async def close(self):
        """Fecha conexão"""
        await self.client.aclose()