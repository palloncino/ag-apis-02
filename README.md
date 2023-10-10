# antonioguiotto.com APIs

These APIs provide insights into Antonio's professional history and more, leveraging the power of Langchain and OpenAI APIs.

## Endpoints

### Ping

Health check.

- **URL**: `https://api.guiotto.link/ping`
- **Method**: `GET`

### Chat Local

Chat about specific text.

- **URL**: `https://api.guiotto.link/chat-local`
- **Method**: `POST`
- **Request Body**:

```json
{
  "prompt": "Tell me about Antonio's hobbies"
}
