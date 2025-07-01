// ARQUIVO: server.js (Versão Final de Depuração de Sessão para Render)

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

// Para o Render funcionar corretamente atrás de um proxy
app.set('trust proxy', 1); 

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax', // 'lax' é geralmente o mais compatível
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// =================================================================
// 5. MIDDLEWARES DE AUTENTICAÇÃO (COM LOGS DE DEPURAÇÃO)
// =================================================================
const isLoggedIn = (req, res, next) => {
    // LOG DE VERIFICAÇÃO
    console.log(`[ISLOGGEDIN CHECK] Verificando acesso para a rota: ${req.originalUrl}`);
    console.log(`[ISLOGGEDIN CHECK] Conteúdo da sessão:`, req.session);

    if (req.session && req.session.userId) {
        console.log(`[ISLOGGEDIN CHECK] Acesso PERMITIDO para o usuário ID: ${req.session.userId}`);
        next();
    } else {
        console.log(`[ISLOGGEDIN CHECK] Acesso NEGADO. Redirecionando para /login.html`);
        res.redirect('/login.html');
    }
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Acesso negado.' });
    }
};

// =================================================================
// 6. ROTAS PÚBLICAS (COM LOGS DE DEPURAÇÃO)
// =================================================================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT id, nickname, password_hash FROM recrutas WHERE email = $1 AND status = 'aprovado'", [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password_hash)) {
                const adminResult = await db.query("SELECT id FROM admins WHERE username = $1", [user.nickname]);
                
                // Criando a sessão
                req.session.userId = user.id;
                req.session.nickname = user.nickname;
                req.session.isAdmin = adminResult.rows.length > 0;
                
                // LOG DE SUCESSO
                console.log(`[LOGIN SUCCESS] Sessão criada com sucesso:`, req.session);

                // Força o salvamento da sessão antes de responder
                req.session.save(err => {
                    if (err) {
                        console.error("Erro ao salvar a sessão:", err);
                        return res.status(500).json({ success: false, message: 'Erro ao iniciar sessão.' });
                    }
                    return res.json({ success: true, redirectUrl: '/dashboard.html' });
                });
                return;
            }
        }
        res.status(401).json({ success: false, message: 'Credenciais inválidas ou recrutamento não aprovado.' });
    } catch (error) {
        console.error("Erro CRÍTICO no /login:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ... (cole aqui o resto das suas rotas: /recrutar, /logout, APIs, etc.)
// ...

// =================================================================
// 7. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor da Facção China rodando na porta ${port}`);
});
