import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
dotenv.config(); // Carga las variables de entorno del archivo .env

const __dirname = path.dirname(__filename); // Carga las variables de entorno del archivo .env
const app = express();
const PORT = 3000;

// --- Middlewares Esenciales ---
app.use(express.json());
app.use(cors());

// --- Servir Archivos Estáticos ---
// Sirve las imágenes subidas desde la carpeta /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Sirve todos los archivos del frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../frontend")));

// --- Redirección a Login ---
// Redirige la ruta raíz ("/") a la página de login.
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// --- Configuración Global de SQLite ---
// ¡Solución definitiva al bloqueo! Al activar el modo "verbose", sqlite3 serializa
// todas las operaciones de escritura internamente, previniendo errores de concurrencia.
sqlite3.verbose(); 
const JWT_SECRET = process.env.JWT_SECRET; // Usamos la variable de entorno

// Verificación de seguridad: Asegurarse de que la clave secreta JWT está cargada.
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET no está definida en el archivo .env");
  process.exit(1); // Detiene la aplicación si la clave no está presente.
}

// Configurar almacenamiento de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "backend/uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Conexión a SQLite
const db = await open({
  filename: "./backend/database.db",
  driver: sqlite3.Database,
});


// Crear tabla de bonsais
await db.exec(`
  CREATE TABLE IF NOT EXISTS bonsais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    especie TEXT,
    edad INTEGER,
    procedencia TEXT,
    fecha_riego TEXT,
    foto TEXT,
    user_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Crear tabla de trabajos
await db.exec(`
  CREATE TABLE IF NOT EXISTS trabajos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_trabajo TEXT,
    fecha TEXT
  )
`);

// Crear tabla de trabajos específicos por bonsái con fotos
await db.exec(`
  CREATE TABLE IF NOT EXISTS trabajos_bonsai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bonsai_id INTEGER NOT NULL,
    trabajo_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    foto_antes TEXT,
    foto_despues TEXT,
    observaciones TEXT,
    FOREIGN KEY(bonsai_id) REFERENCES bonsais(id) ON DELETE CASCADE,
    FOREIGN KEY(trabajo_id) REFERENCES trabajos(id)
  )
`);

// Crear tabla de usuarios
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'approved'
    role TEXT DEFAULT 'user' NOT NULL -- 'user', 'admin', 'moderator'
  )
`);

// Crear tabla de procedencias
await db.exec(`
  CREATE TABLE IF NOT EXISTS procedencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL
  )
`);

// Crear tabla de tareas pendientes
await db.exec(`
  CREATE TABLE IF NOT EXISTS tareas_pendientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bonsai_id INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    completada INTEGER DEFAULT 0, -- 0 for false, 1 for true
    fecha_creacion TEXT NOT NULL,
    fecha_limite TEXT,
    observaciones TEXT,
    FOREIGN KEY(bonsai_id) REFERENCES bonsais(id) ON DELETE CASCADE
  )
`);

// Middleware de protección de rutas
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Token no es válido" });
      }
      req.user = user; // Añade el usuario decodificado a la request
      next();
    });
  } else {
    res.status(401).json({ message: "No autorizado, no hay token" });
  }
};

// Middleware para verificar si el usuario es administrador
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: "Acceso denegado. Se requiere rol de administrador." });
  }
};

// Middleware para bloquear la creación/actualización si el rol es moderador
const blockWriteAccessForModerator = (req, res, next) => {
  if (req.user && req.user.role === 'moderator') {
    return res.status(403).json({ message: "Acción no permitida para moderadores." });
  }
  next();
};

// Obtener todos los bonsáis
app.get("/api/bonsais", protect, async (req, res) => {
  // Si el usuario es moderador, devuelve todos los bonsáis con el email del dueño.
  if (req.user.role === 'moderator') {
    const bonsais = await db.all(`
      SELECT b.*, u.email as owner_email 
      FROM bonsais b 
      JOIN users u ON b.user_id = u.id`);
    return res.json(bonsais);
  }

  // Si es un usuario normal ('user') o un administrador ('admin'), solo devuelve sus propios bonsáis.
  const bonsais = await db.all("SELECT * FROM bonsais WHERE user_id = ?", req.user.id);
  return res.json(bonsais);
});

// Obtener un bonsái específico por ID
app.get("/api/bonsais/:id", protect, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const bonsai = await db.get("SELECT * FROM bonsais WHERE id = ?", id);

  if (!bonsai) {
    return res.status(404).json({ message: "Bonsái no encontrado." });
  }

  // Un usuario normal solo puede ver sus propios bonsáis.
  // Un admin o moderador puede ver cualquiera.
  if (user.role === 'user' && bonsai.user_id !== user.id) {
    return res.status(403).json({ message: "No tienes permiso para ver este bonsái." });
  }

  // Si es admin o moderador, añadimos el email del dueño para mostrarlo
  const owner = await db.get("SELECT email FROM users WHERE id = ?", bonsai.user_id);
  bonsai.owner_email = owner ? owner.email : 'Desconocido';

  res.json(bonsai);
});

// Crear un bonsái con imagen
app.post("/api/bonsais", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { nombre, especie, edad, fecha_riego, procedencia } = req.body;
  const foto = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.user.id;

  const result = await db.run(
    "INSERT INTO bonsais (nombre, especie, edad, fecha_riego, foto, user_id, procedencia) VALUES (?, ?, ?, ?, ?, ?, ?)",
    nombre, especie, edad, fecha_riego, foto, userId, procedencia
  );

  res.json({ id: result.lastID, foto });
});

// Actualizar bonsái
app.put("/api/bonsais/:id", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const { nombre, especie, edad, fecha_riego, procedencia } = req.body;
  let foto = req.file ? `/uploads/${req.file.filename}` : null;

  if (!foto) {
    const existing = await db.get("SELECT foto FROM bonsais WHERE id = ?", id);
    foto = existing.foto;
  }

  await db.run(
    "UPDATE bonsais SET nombre=?, especie=?, edad=?, fecha_riego=?, foto=?, procedencia=? WHERE id=? AND user_id = ?",
    nombre, especie, edad, fecha_riego, foto, procedencia, id, req.user.id
  );

  res.json({ success: true });
});

// Eliminar bonsái
app.delete("/api/bonsais/:id", protect, async (req, res) => {
  try {
    const { id } = req.params; // ID del bonsái a eliminar
    const user = req.user; // Usuario que realiza la acción

    // Primero, obtenemos el bonsái para verificar permisos
    const bonsaiToDelete = await db.get("SELECT user_id, foto FROM bonsais WHERE id = ?", id);

    if (!bonsaiToDelete) {
      return res.status(404).json({ message: "Bonsái no encontrado." });
    }

    // Lógica de permisos
    if (user.role === 'user' && bonsaiToDelete.user_id !== user.id) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este bonsái." });
    }

    if (user.role === 'moderator') {
      const owner = await db.get("SELECT role FROM users WHERE id = ?", bonsaiToDelete.user_id);
      if (owner && owner.role === 'admin') {
        return res.status(403).json({ message: "Los moderadores no pueden eliminar bonsáis de administradores." });
      }
    }

    // Si se superan las validaciones, procedemos a eliminar
    if (bonsaiToDelete.foto) {
      const imgPath = path.join(__dirname, bonsaiToDelete.foto);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await db.run("DELETE FROM bonsais WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor al eliminar el bonsái." });
  }
});

// --- API para Usuarios ---

// Registrar un nuevo usuario
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Por favor, introduce email y contraseña" });
  }

  const userExists = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (userExists) {
    return res.status(400).json({ message: "El usuario ya existe" });
  }

  // Asignar rol de admin si el email es el del administrador
  const role = email === 'jmforte63@gmail.com' ? 'admin' : 'user';
  const status = email === 'jmforte63@gmail.com' ? 'approved' : 'pending';

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const result = await db.run("INSERT INTO users (email, password, role, status) VALUES (?, ?, ?, ?)", email, hashedPassword, role, status);
  res.status(201).json({ id: result.lastID, email });
});

// Iniciar sesión (autenticar usuario)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email = ?", email);

  if (user && (await bcrypt.compare(password, user.password))) {    
    // Si el usuario no es admin y su cuenta no está aprobada, denegar acceso.
    if (user.role !== 'admin' && user.status !== 'approved') {
      return res.status(403).json({ message: "Tu cuenta está pendiente de aprobación por un administrador." });
    }

    // Generar token
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "1d", // El token expira en 1 día
    });
    res.json({
      id: user.id,
      role: user.role,
      email: user.email,
      token: token,
    });
  } else {
    res.status(401).json({ message: "Email o contraseña inválidos" });
  }
});

// --- API para Administración ---

// Obtener estadísticas generales (solo para admins)
app.get("/api/admin/stats", protect, isAdmin, async (req, res) => {
  try {
    const userStats = await db.get("SELECT COUNT(*) as count FROM users");
    const bonsaiStats = await db.get("SELECT COUNT(*) as count FROM bonsais");

    res.json({
      totalUsers: userStats.count,
      totalBonsais: bonsaiStats.count,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las estadísticas." });
  }
});

// Obtener todos los usuarios (excepto el admin actual) para gestionarlos
app.get("/api/admin/users", protect, isAdmin, async (req, res) => {
  // Excluir al admin que hace la petición de la lista
  const users = await db.all("SELECT id, email, status, role FROM users WHERE id <> ?", req.user.id);
  res.json(users);
});

// Actualizar el estado de un usuario (aprobar/revocar) por su ID
app.put("/api/admin/user-status/:id", protect, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'pending'

  // Validar que el estado sea uno de los permitidos
  if (!['approved', 'pending'].includes(status)) {
      return res.status(400).json({ message: "Estado no válido." });
  }

  // Medida de seguridad: Prevenir que se cambie el estado de otro administrador
  const userToUpdate = await db.get("SELECT role FROM users WHERE id = ?", id);
  if (userToUpdate && userToUpdate.role === 'admin') {
      return res.status(403).json({ message: "No se puede cambiar el estado de un administrador." });
  }

  await db.run("UPDATE users SET status = ? WHERE id = ?", status, id);
  // Devolvemos la lista de usuarios actualizada para evitar una segunda llamada desde el frontend
  const users = await db.all("SELECT id, email, status, role FROM users WHERE id <> ?", req.user.id);
  res.json(users);
});

// Actualizar el ROL de un usuario por su ID
app.put("/api/admin/user-role/:id", protect, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validar que el rol sea uno de los permitidos
  const validRoles = ['user', 'moderator', 'admin'];
  if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Rol no válido." });
  }

  // Medida de seguridad: Prevenir que se cambie el rol de otro administrador
  const userToUpdate = await db.get("SELECT role FROM users WHERE id = ?", id);
  if (userToUpdate && userToUpdate.role === 'admin') {
      return res.status(403).json({ message: "No se puede cambiar el rol de un administrador." });
  }

  await db.run("UPDATE users SET role = ? WHERE id = ?", role, id);

  // Devolvemos la lista de usuarios actualizada para evitar una segunda llamada desde el frontend
  const users = await db.all("SELECT id, email, status, role FROM users WHERE id <> ?", req.user.id);
  res.json(users);
});

// Eliminar un usuario por su ID
app.delete("/api/admin/user/:id", protect, isAdmin, async (req, res) => {
  const { id } = req.params;

  // Medida de seguridad: Prevenir que un admin se elimine a sí mismo o a otro admin.
  const userToDelete = await db.get("SELECT role FROM users WHERE id = ?", id);
  if (!userToDelete) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }
  if (userToDelete.role === 'admin') {
    return res.status(403).json({ message: "No se puede eliminar a un administrador." });
  }

  await db.run("DELETE FROM users WHERE id = ?", id);

  // Devolvemos la lista de usuarios actualizada para que el frontend se refresque.
  const users = await db.all("SELECT id, email, status, role FROM users WHERE id <> ?", req.user.id);
  res.json(users);
});


// --- API para Trabajos ---

// Obtener todos los trabajos
app.get("/api/trabajos", protect, async (req, res) => {
  const trabajos = await db.all("SELECT * FROM trabajos ORDER BY fecha DESC");
  res.json(trabajos);
});

// Crear un nuevo trabajo
app.post("/api/trabajos", protect, blockWriteAccessForModerator, async (req, res) => {
  const { tipo_trabajo, fecha } = req.body;
  const result = await db.run(
    "INSERT INTO trabajos (tipo_trabajo, fecha) VALUES (?, ?)",
    tipo_trabajo, fecha
  );
  res.json({ id: result.lastID });
});

// Actualizar un trabajo
app.put("/api/trabajos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { tipo_trabajo, fecha } = req.body;

  await db.run(
    "UPDATE trabajos SET tipo_trabajo = ?, fecha = ? WHERE id = ?",
    tipo_trabajo, fecha, id
  );

  res.json({ success: true });
});

// Eliminar un trabajo
app.delete("/api/trabajos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  await db.run("DELETE FROM trabajos WHERE id = ?", id);
  res.json({ success: true });
});

// --- API para Procedencias ---

// Obtener todas las procedencias
app.get("/api/procedencias", protect, async (req, res) => {
  const procedencias = await db.all("SELECT * FROM procedencias ORDER BY nombre");
  res.json(procedencias);
});

// Crear una nueva procedencia (solo admin)
app.post("/api/procedencias", protect, isAdmin, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es requerido." });
  try {
    const result = await db.run("INSERT INTO procedencias (nombre) VALUES (?)", nombre);
    res.status(201).json({ id: result.lastID, nombre });
  } catch (error) {
    res.status(400).json({ message: "La procedencia ya existe." });
  }
});

// Eliminar una procedencia (solo admin)
app.delete("/api/procedencias/:id", protect, isAdmin, async (req, res) => {
  await db.run("DELETE FROM procedencias WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Actualizar una procedencia (solo admin)
app.put("/api/procedencias/:id", protect, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es requerido." });
  try {
    // El constraint UNIQUE en la DB previene duplicados
    await db.run("UPDATE procedencias SET nombre = ? WHERE id = ?", nombre, id);
    res.json({ id: parseInt(id, 10), nombre });
  } catch (error) {
    res.status(400).json({ message: "La procedencia ya existe o hubo un error al actualizar." });
  }
});

// --- API para Tareas Pendientes ---

// Obtener todas las tareas de un bonsái específico
app.get("/api/bonsais/:id/tareas", protect, async (req, res) => {
    const { id } = req.params;
    const bonsai = await db.get("SELECT user_id FROM bonsais WHERE id = ?", id);
    if (!bonsai) {
        return res.status(404).json({ message: "Bonsái no encontrado." });
    }
    if (req.user.role === 'user' && bonsai.user_id !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para ver las tareas de este bonsái." });
    }

    const tareas = await db.all("SELECT * FROM tareas_pendientes WHERE bonsai_id = ? ORDER BY completada ASC, fecha_creacion DESC", id);
    res.json(tareas);
});

// Crear una nueva tarea para un bonsái
app.post("/api/bonsais/:id/tareas", protect, blockWriteAccessForModerator, async (req, res) => {
    const bonsai_id = req.params.id;
    const { descripcion, fecha_limite, observaciones } = req.body;
    if (!descripcion) {
        return res.status(400).json({ message: "La descripción es requerida." });
    }
    const fecha_creacion = new Date().toISOString();
    const result = await db.run(
        "INSERT INTO tareas_pendientes (bonsai_id, descripcion, fecha_creacion, fecha_limite, observaciones) VALUES (?, ?, ?, ?, ?)",
        bonsai_id, descripcion, fecha_creacion, fecha_limite || null, observaciones || null
    );
    res.status(201).json({ id: result.lastID, bonsai_id, descripcion, completada: 0, fecha_creacion, fecha_limite, observaciones });
});

// Actualizar una tarea (marcar como completada/pendiente)
app.put("/api/tareas/:id", protect, blockWriteAccessForModerator, async (req, res) => {
    const { id } = req.params;
    const { completada } = req.body;

    if (typeof completada === 'undefined') {
        return res.status(400).json({ message: "El estado 'completada' es requerido." });
    }

    await db.run("UPDATE tareas_pendientes SET completada = ? WHERE id = ?", completada ? 1 : 0, id);
    const tareaActualizada = await db.get("SELECT * FROM tareas_pendientes WHERE id = ?", id);
    res.json(tareaActualizada);
});

// Eliminar una tarea pendiente
app.delete("/api/tareas/:id", protect, async (req, res) => {
    const { id } = req.params;
    // Aquí podrías añadir una lógica de permisos similar a la de eliminar trabajos si fuera necesario
    const result = await db.run("DELETE FROM tareas_pendientes WHERE id = ?", id);
    if (result.changes === 0) {
        return res.status(404).json({ message: "Tarea no encontrada." });
    }
    res.json({ success: true });
});

// Mover una tarea pendiente al historial de trabajos realizados
app.post("/api/tareas/:id/mover-a-historial", protect, blockWriteAccessForModerator, async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener la tarea pendiente
        const tarea = await db.get("SELECT * FROM tareas_pendientes WHERE id = ?", id);
        if (!tarea) {
            return res.status(404).json({ message: "Tarea no encontrada." });
        }

        // 2. Encontrar el 'trabajo_id' correspondiente a la descripción de la tarea
        const trabajo = await db.get("SELECT id FROM trabajos WHERE tipo_trabajo = ?", tarea.descripcion);
        if (!trabajo) {
            return res.status(400).json({ message: `El tipo de trabajo "${tarea.descripcion}" no existe en el registro de trabajos.` });
        }

        // 3. Crear una nueva entrada en 'trabajos_bonsai'
        const fechaRealizacion = new Date().toISOString().split('T')[0]; // Fecha actual
        await db.run(
            "INSERT INTO trabajos_bonsai (bonsai_id, trabajo_id, fecha, observaciones) VALUES (?, ?, ?, ?)",
            tarea.bonsai_id, trabajo.id, fechaRealizacion, tarea.observaciones
        );

        // 4. Eliminar la tarea de 'tareas_pendientes'
        await db.run("DELETE FROM tareas_pendientes WHERE id = ?", id);

        // 5. Actualizar la fecha del último trabajo en la tabla de bonsais
        await db.run("UPDATE bonsais SET fecha_riego = ? WHERE id = ?", fechaRealizacion, tarea.bonsai_id);

        res.json({ success: true, message: "Tarea movida al historial con éxito." });
    } catch (error) {
        console.error("Error al mover tarea a historial:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});


// --- API para Trabajos Específicos de un Bonsái ---

// Obtener todos los trabajos de un bonsái específico
app.get("/api/bonsais/:id/trabajos", async (req, res) => {
  const { id } = req.params;
  const trabajosRealizados = await db.all(`
    SELECT tb.id, tb.fecha, tb.foto_antes, tb.foto_despues, t.tipo_trabajo, tb.trabajo_id, tb.observaciones
    FROM trabajos_bonsai tb
    JOIN trabajos t ON tb.trabajo_id = t.id
    WHERE tb.bonsai_id = ?
    ORDER BY tb.fecha DESC
  `, id);
  res.json(trabajosRealizados);
});

// Añadir un nuevo trabajo a un bonsái (con antes y después)
app.post("/api/trabajos_bonsai", protect, blockWriteAccessForModerator, upload.fields([
  { name: 'foto_antes', maxCount: 1 },
  { name: 'foto_despues', maxCount: 1 }
]), async (req, res) => {
  const { bonsai_id, trabajo_id, fecha, observaciones } = req.body;
  const foto_antes = req.files['foto_antes'] ? `/uploads/${req.files['foto_antes'][0].filename}` : null;
  const foto_despues = req.files['foto_despues'] ? `/uploads/${req.files['foto_despues'][0].filename}` : null;

  const result = await db.run(
    "INSERT INTO trabajos_bonsai (bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones) VALUES (?, ?, ?, ?, ?, ?)",
    bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones
  );

  // Actualizamos la fecha del último trabajo en la tabla de bonsais
  await db.run("UPDATE bonsais SET fecha_riego = ? WHERE id = ?", fecha, bonsai_id);

  res.json({ id: result.lastID });
});

// Eliminar un trabajo de un bonsái
app.delete("/api/trabajos_bonsai/:id", protect, async (req, res) => {
  try {
    const { id } = req.params; // ID del trabajo_bonsai a eliminar
    const user = req.user; // Usuario que realiza la acción

    // Obtenemos el trabajo y el rol del dueño del bonsái asociado
    const jobInfo = await db.get(`
      SELECT tb.foto_antes, tb.foto_despues, b.user_id as owner_id, u.role as owner_role
      FROM trabajos_bonsai tb
      JOIN bonsais b ON tb.bonsai_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE tb.id = ?
    `, id);

    if (!jobInfo) {
      return res.status(404).json({ message: "Trabajo no encontrado." });
    }

    // --- Lógica de Permisos ---
    // 1. Un usuario normal solo puede borrar trabajos de sus propios bonsáis.
    if (user.role === 'user' && jobInfo.owner_id !== user.id) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este trabajo." });
    }
    // 2. Un moderador no puede borrar trabajos de un admin.
    if (user.role === 'moderator' && jobInfo.owner_role === 'admin') {
      return res.status(403).json({ message: "Los moderadores no pueden eliminar trabajos de bonsáis que pertenecen a un administrador." });
    }

    // Si se superan las validaciones, procedemos a eliminar las imágenes
    if (jobInfo.foto_antes) {
      const imgPath = path.join(__dirname, jobInfo.foto_antes);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    if (jobInfo.foto_despues) {
      const imgPath = path.join(__dirname, jobInfo.foto_despues);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    // Después de eliminar, buscamos el nuevo trabajo más reciente para actualizar la fecha principal del bonsái
    const newLatestJob = await db.get(
      "SELECT fecha FROM trabajos_bonsai WHERE bonsai_id = ? ORDER BY fecha DESC LIMIT 1",
      jobInfo.bonsai_id
    );

    // Si encontramos un nuevo trabajo más reciente, actualizamos la fecha.
    // Si no quedan trabajos, podríamos poner la fecha a null o dejarla como estaba.
    // Por ahora, la actualizamos si existe un nuevo trabajo.
    if (newLatestJob) {
      await db.run("UPDATE bonsais SET fecha_riego = ? WHERE id = ?", newLatestJob.fecha, jobInfo.bonsai_id);
    } else {
      // Opcional: si no quedan trabajos, podríamos limpiar la fecha.
      await db.run("UPDATE bonsais SET fecha_riego = NULL WHERE id = ?", jobInfo.bonsai_id);
    }

    await db.run("DELETE FROM trabajos_bonsai WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor al eliminar el trabajo." });
  }
});

// Actualizar un trabajo de un bonsái
app.put("/api/trabajos_bonsai/:id", protect, blockWriteAccessForModerator, upload.fields([
  { name: 'foto_antes', maxCount: 1 },
  { name: 'foto_despues', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  const { trabajo_id, fecha, observaciones } = req.body;

  // Obtener el registro existente para saber las fotos actuales
  const existing = await db.get("SELECT foto_antes, foto_despues, observaciones FROM trabajos_bonsai WHERE id = ?", id);

  // Si se sube una nueva foto, se usa. Si no, se mantiene la existente.
  const foto_antes = req.files['foto_antes'] ? `/uploads/${req.files['foto_antes'][0].filename}` : (existing ? existing.foto_antes : null);
  const foto_despues = req.files['foto_despues'] ? `/uploads/${req.files['foto_despues'][0].filename}` : (existing ? existing.foto_despues : null);

  // Borrar fotos antiguas si se subieron nuevas
  if (req.files['foto_antes'] && existing && existing.foto_antes) {
      const imgPath = path.join(process.cwd(), "backend", existing.foto_antes);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  if (req.files['foto_despues'] && existing && existing.foto_despues) {
      const imgPath = path.join(process.cwd(), "backend", existing.foto_despues);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  await db.run(
    "UPDATE trabajos_bonsai SET trabajo_id = ?, fecha = ?, foto_antes = ?, foto_despues = ?, observaciones = ? WHERE id = ?",
    trabajo_id, fecha, foto_antes, foto_despues, observaciones, id
  );

  // Actualizamos la fecha del último trabajo en la tabla de bonsais
  await db.run("UPDATE bonsais SET fecha_riego = ? WHERE id = ?", fecha, existing.bonsai_id);
  res.json({ success: true });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🌳 Servidor Bonsai corriendo en http://localhost:${PORT}`));

// --- Ruta Catch-all para SPA (Single Page Application) ---
// Esta debe ser la ÚLTIMA ruta. Si ninguna ruta de API o archivo estático coincide, 
// devuelve el index.html. Esto permite que la navegación del lado del cliente (frontend) funcione
// correctamente, incluso si se recarga la página en una URL como /bonsai_detalle.html?id=1
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});
