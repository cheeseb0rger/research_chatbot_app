# AI Research Assistant
A fullstack AI platform designed to research topics and cite sources when generating a response.

## Prerequisites  
- Node.js v24+
- MongoDB


## Backend Server Setup
1. **Navigate to `server` directory.**
    ```bash
    cd server
    ```

2. **Add .env file.**

    Use example provided at `server/.env.example`.
    ```bash
    cp .env.example .env
    ```
    Replace the placeholder values.\
    *You will need an OpenRouter API key.

3. **Install Dependencies.**
    ```bash
    npm install
    ```

4. **Start the backend.** 
    ```bash
    npm run start
    ```


## Frontend Client Setup
1. **Open a new terminal.**
2. **Navigate to `client` directory.**
    ```bash
    cd client
    ```
3. **Install Dependencies.**
    ```bash
    npm install
    ```

4. **Start the frontend.** 
    ```bash
    npm run dev
    ```
    or

    ```bash
    npm run build
    npm run preview
    ```

    Dev runs on `http://localhost:5173/`\
    Build runs on `http://localhost:4173/`