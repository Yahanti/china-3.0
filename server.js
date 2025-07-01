// 1. IMPORTAÇÕES PARA POSTGRESQL
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// 2. CONFIGURAÇÕES INICIAIS
const app = express();
const port = process.env.PORT || 3000; // O Render usa process.env.PORT
const saltRounds = 10;

// 3. MIDDLEWARES
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =================================================================
// 4. BANCO DE DADOS E SESSÃO
// =================================================================
const db = new Pool({ /* ... sua configuração do pool ... */ });
const sessionStore = new pgSession({ /* ... sua configuração da loja ... */ });


// VAMOS ADICIONAR O TESTE AQUI
console.log("--- INICIANDO VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE ---");
console.log("Valor de SESSION_SECRET:", process.env.SESSION_SECRET);
console.log("--- FIM DA VERIFICAÇÃO ---");


// Bloco da sessão original
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));
// 5. MIDDLEWARES DE AUTENTICAÇÃO (sem alterações)
const isLoggedIn = (req, res, next) => {
    if (!req.session.userId) { return res.redirect('/login.html'); }
    next();
};
const isAdmin = (req, res, next) => {
    if (!req.session.isAdmin) { return res.status(403).json({ error: 'Acesso negado.' }); }
    next();
};

// 6. ROTAS PÚBLICAS (SINTAXE POSTGRESQL: $1, $2...)
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
// Adicione outras rotas GET para suas páginas aqui

app.post('/recrutar', async (req, res) => {
    const { nickname, gameid, email, password } = req.body;
    if (!nickname || !gameid || !email || !password) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await db.query("INSERT INTO recrutas (nickname, game_id, email, password_hash) VALUES ($1, $2, $3, $4)", [nickname, gameid, email, passwordHash]);
        res.status(201).json({ success: true, message: 'Recrutamento enviado com sucesso!' });
    } catch (error) {
        // Código de erro para 'duplicado' no PostgreSQL é '23505'
        if (error.code === '23505') { return res.status(409).json({ success: false, message: 'Este email já foi cadastrado.' }); }
        console.error("Erro no /recrutar:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ... (cole aqui as outras rotas do seu server.js. A sintaxe delas também precisa usar $1, $2, etc.)
// Exemplo da rota de login:
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT id, nickname, password_hash FROM recrutas WHERE email = $1 AND status = 'aprovado'", [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password_hash)) {
                const adminResult = await db.query("SELECT id FROM admins WHERE username = $1", [user.nickname]);
                req.session.userId = user.id;
                req.session.nickname = user.nickname;
                req.session.isAdmin = adminResult.rows.length > 0;
                return res.json({ success: true, redirectUrl: '/dashboard.html' });
            }
        }
        res.status(401).json({ success: false, message: 'Credenciais inválidas ou recrutamento não aprovado.' });
    } catch (error) {
        console.error("Erro no /login:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ... adicione todas as outras rotas aqui (logout, apis, etc)

// 7. INICIAR O SERVIDOR
app.listen(port, () => {
    console.log(`Servidor da Facção China rodando na porta ${port}`);
});
