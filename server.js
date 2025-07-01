// ARQUIVO: server.js (Versão Final e Completa para Render/PostgreSQL)

require('dotenv').config();

// 1. IMPORTAÇÕES
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// 2. CONFIGURAÇÕES
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// 3. MIDDLEWARES
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 4. BANCO DE DADOS E SESSÃO
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const sessionStore = new pgSession({
    pool: db,
    tableName: 'session'
});

app.set('trust proxy', 1); 

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

// 5. MIDDLEWARES DE AUTENTICAÇÃO
const isLoggedIn = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    res.redirect('/login.html');
};
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(403).json({ error: 'Acesso negado.' });
};

// 6. ROTAS PÚBLICAS
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
// Adicione outras rotas GET para suas páginas aqui

app.post('/recrutar', async (req, res) => {
    // ... (código da rota /recrutar, sem alterações)
});

app.post('/login', async (req, res) => {
    // ... (código da rota /login, sem alterações)
});

app.get('/logout', (req, res) => {
    // ... (código da rota /logout, sem alterações)
});

// =================================================================
// 7. ROTAS PROTEGIDAS E APIs DO DASHBOARD (VERSÃO COMPLETA)
// =================================================================
app.get('/dashboard.html', isLoggedIn, (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });

app.get('/api/user/me', isLoggedIn, (req, res) => {
    res.json({
        nickname: req.session.nickname,
        isAdmin: req.session.isAdmin || false
    });
});

// ROTA PARA MEMBROS - ESTA ESTAVA FALTANDO NO SEU SERVIDOR
app.get('/api/membros', isLoggedIn, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT nickname FROM recrutas WHERE status = 'aprovado' ORDER BY nickname ASC");
        res.json(rows);
    } catch (error) {
        console.error("Erro em /api/membros:", error);
        res.status(500).json({ error: 'Erro ao buscar membros.' });
    }
});

app.get('/api/avisos', isLoggedIn, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM avisos ORDER BY data_criacao DESC');
        res.json(rows);
    } catch (error) {
        console.error("Erro em /api/avisos:", error);
        res.status(500).json({ error: 'Erro ao buscar avisos.' });
    }
});

// ... (outras APIs como /api/chat aqui)

// --- APIs de Administração ---

app.get('/api/health', async (req, res) => {
    try {
        // Faz uma consulta super simples e rápida só para "acordar" o banco.
        await db.query('SELECT 1');
        console.log("Health check bem-sucedido. Banco de dados está acordado.");
        res.json({ status: 'ok', message: 'Conexão com o banco de dados está ativa.' });
    } catch (error) {
        console.error("Health check falhou:", error);
        res.status(503).json({ status: 'error', message: 'Não foi possível conectar ao banco de dados.' });
    }
});

// ROTA PARA RECRUTAS PENDENTES - ESTA TAMBÉM ESTAVA FALTANDO
app.get('/api/admin/recrutas-pendentes', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, nickname, email, game_id, data_registro FROM recrutas WHERE status = 'pendente' ORDER BY data_registro ASC");
        res.json(rows);
    } catch (error) {
        console.error("Erro em /api/admin/recrutas-pendentes:", error);
        res.status(500).json({ error: 'Erro ao buscar recrutas pendentes.' });
    }
});

app.post('/api/admin/aprovar/:id', isLoggedIn, isAdmin, async (req, res) => {
    // ... (código da rota /api/admin/aprovar, sem alterações)
});

app.post('/api/admin/rejeitar/:id', isLoggedIn, isAdmin, async (req, res) => {
    // ... (código da rota /api/admin/rejeitar, sem alterações)
});

// =================================================================
// 8. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor da Facção China rodando na porta ${port}`);
});
