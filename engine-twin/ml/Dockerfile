FROM python:3.11-slim

WORKDIR /app

# torch pulls in a lot — cache layer separately
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "src.serve:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
