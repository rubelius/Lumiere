import torch
from sentence_transformers import SentenceTransformer


class MLService:
    def __init__(self):
        # 1. Escolhe a GPU do Mac M1 (mps) se disponível, senão usa CPU
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        
        # 2. Carrega o modelo de verdade (isso "preenche" o self.model)
        # O modelo 'all-MiniLM-L6-v2' é ótimo para começar (leve e rápido)
        self.model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

    def generate_embedding(self, text: str):
        # Agora o self.model não é mais None, ele é o modelo carregado!
        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            show_progress_bar=False
        )
        return embedding
