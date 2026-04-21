import re
from datetime import datetime
from typing import Dict, List, Optional

import feedparser
import httpx
from bs4 import BeautifulSoup


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
        
        Returns:
            Lista de dicts com film, date, rating, review
        """
        feed_url = f"{self.BASE_URL}/{self.username}/rss"
        
        try:
            response = await self.client.get(feed_url)
            response.raise_for_status()
            
            feed = feedparser.parse(response.text)
            entries = []
            
            for entry in feed.entries[:limit]:
                # Parse HTML description
                soup = BeautifulSoup(entry.description, 'html.parser')
                
                # Extract rating (stars)
                rating = None
                rating_elem = soup.find('span', class_='rating')
                if rating_elem:
                    stars = len(rating_elem.find_all('span', class_='rated-'))
                    rating = stars * 0.5  # Each star = 0.5
                
                # Extract review text
                review = ''
                review_elem = soup.find('p')
                if review_elem:
                    review = review_elem.get_text(strip=True)
                
                # Parse film info from title
                # Format: "Film Name, Year - ★★★★½"
                title_parts = entry.title.split(' - ')
                film_info = title_parts[0] if title_parts else entry.title
                
                # Extract year
                year_match = re.search(r', (\d{4})', film_info)
                year = int(year_match.group(1)) if year_match else None
                film_name = re.sub(r', \d{4}$', '', film_info) if year else film_info
                
                entries.append({
                    'entry_id': entry.id,
                    'film_name': film_name,
                    'film_year': year,
                    'watched_date': datetime(*entry.published_parsed[:6]).date(),
                    'rating': rating,
                    'review': review,
                    'link': entry.link,
                    'rewatch': 'Rewatched' in entry.description,
                    'like': '♥' in entry.description,
                })
            
            return entries
        
        except Exception as e:
            print(f"Error fetching Letterboxd diary: {e}")
            return []
    
    async def get_lists(self) -> List[Dict]:
        """
        Busca listas públicas do usuário via scraping
        
        Returns:
            Lista de dicts com name, url, film_count
        """
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/{self.username}/lists"
            )
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
                
                lists.append({
                    'name': link_elem.get_text(strip=True),
                    'url': self.BASE_URL + link_elem['href'],
                    'list_id': link_elem['href'].strip('/'),
                    'film_count': film_count,
                    'description': description,
                })
            
            return lists
        
        except Exception as e:
            print(f"Error fetching Letterboxd lists: {e}")
            return []
    
    async def get_list_films(self, list_url: str) -> List[Dict]:
        """
        Busca filmes de uma lista específica
        
        Args:
            list_url: URL completa da lista
        
        Returns:
            Lista de dicts com film_name, film_year, position
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
                
                film_name = img.get('alt', '')
                
                # Try to extract year from data attributes
                film_link = poster.find('a')
                year = None
                if film_link and 'data-film-slug' in film_link.attrs:
                    slug = film_link['data-film-slug']
                    # Slug format: film-name-year
                    year_match = re.search(r'-(\d{4})$', slug)
                    if year_match:
                        year = int(year_match.group(1))
                
                films.append({
                    'position': idx,
                    'film_name': film_name,
                    'film_year': year,
                    'letterboxd_slug': film_link.get('data-film-slug') if film_link else None,
                })
            
            return films
        
        except Exception as e:
            print(f"Error fetching list films: {e}")
            return []
    
    async def get_watchlist(self) -> List[Dict]:
        """
        Busca watchlist do usuário
        Similar a get_list_films mas para /watchlist
        """
        watchlist_url = f"{self.BASE_URL}/{self.username}/watchlist"
        return await self.get_list_films(watchlist_url)
    
    async def close(self):
        """Fecha conexão"""
        await self.client.aclose()