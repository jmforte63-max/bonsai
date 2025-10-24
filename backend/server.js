import express from "express";
import mysql from 'mysql2/promise';
import cors from "cors";
import multer from "multer";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
import { config } from "dotenv";
import PG from "pg";
config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') }); // Carga las variables de entorno del archivo .env

const app = express();
const PORT = 3000;
const pool = new PG.Pool({
  connectionString: process.env.DATABASE_URL,
  //ssl:  true

})
app.get ('/ping', async (req, res) =>{

 const result =await pool.query ('SELECT NOW()');
 return res.json(result.rows[0])

})
// --- Middlewares Esenciales ---
app.use(express.json());
app.use(cors());

// --- Servir Archivos Estáticos ---
// Sirve las imágenes subidas desde la carpeta /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Sirve todos los archivos del frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../frontend")));

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

// --- Conexión a MySQL y Creación de Tablas ---
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const createTables = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL
    )
  `);
  // Añadir la columna foto_perfil si no existe, para instalaciones existentes
  await db.execute(`ALTER TABLE users ADD COLUMN foto_perfil VARCHAR(255) DEFAULT NULL;`)
    .catch(err => {
      // Ignorar el error si la columna ya existe
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bonsais (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nombre VARCHAR(255),
      especie VARCHAR(255),
      edad INT,
      procedencia VARCHAR(255),
      fecha_riego DATE,
      foto VARCHAR(255),
      user_id INT NOT NULL,
      abono_id INT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(abono_id) REFERENCES abonos(id) ON DELETE SET NULL
    )
  `);
  await db.execute(`
    ALTER TABLE bonsais CHANGE COLUMN fecha_riego fecha_ultimo_trabajo DATE;
  `).catch(err => {
    if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  });
  // Añadir la columna abono_id si no existe, para instalaciones existentes
  await db.execute(`ALTER TABLE bonsais ADD COLUMN abono_id INT DEFAULT NULL;`)
    .catch(err => {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    });
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cuidados_especie (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      especie VARCHAR(255) NOT NULL,
      descripcion TEXT,
      UNIQUE KEY (user_id, especie),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trabajos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tipo_trabajo VARCHAR(255) UNIQUE,
      fecha DATE
    )
  `);
  await db.execute(`ALTER TABLE trabajos ADD UNIQUE (tipo_trabajo);`).catch(err => {
    // Ignoramos el error si el índice ya existe (ER_DUP_KEYNAME)
    // o si no se puede crear porque ya hay datos duplicados (ER_DUP_ENTRY).
    if (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_DUP_ENTRY') throw err;
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS trabajos_bonsai (
      id INT PRIMARY KEY AUTO_INCREMENT,
      bonsai_id INT NOT NULL,
      trabajo_id INT NOT NULL,
      fecha DATE NOT NULL,
      foto_antes VARCHAR(255),
      foto_despues VARCHAR(255),
      observaciones TEXT,
      abono_id INT,
      FOREIGN KEY(bonsai_id) REFERENCES bonsais(id) ON DELETE CASCADE,
      FOREIGN KEY(trabajo_id) REFERENCES trabajos(id),
      FOREIGN KEY(abono_id) REFERENCES abonos(id) ON DELETE SET NULL
    )
  `);
  // Añadir la columna abono_id si no existe, para instalaciones existentes
  await db.execute(`ALTER TABLE trabajos_bonsai ADD COLUMN abono_id INT DEFAULT NULL;`)
    .catch(err => {
      // Ignorar el error si la columna ya existe
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    });
  await db.execute(`
    CREATE TABLE IF NOT EXISTS procedencias (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nombre VARCHAR(255) UNIQUE NOT NULL
    )
  `);
  // Nos aseguramos de que el índice UNIQUE exista en tablas ya creadas
  await db.execute(`ALTER TABLE procedencias ADD UNIQUE (nombre);`).catch(err => { if (err.code !== 'ER_DUP_KEYNAME') throw err; });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tareas_pendientes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      bonsai_id INT NOT NULL,
      descripcion TEXT NOT NULL,
      completada BOOLEAN DEFAULT false,
      fecha_creacion DATETIME NOT NULL,
      fecha_limite DATE,
      observaciones TEXT,
      FOREIGN KEY(bonsai_id) REFERENCES bonsais(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS macetas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      foto VARCHAR(255),
      ancho DECIMAL(6, 2),
      largo DECIMAL(6, 2),
      profundo DECIMAL(6, 2),
      libre BOOLEAN DEFAULT true,
      bonsai_id INT,
      user_id INT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(bonsai_id) REFERENCES bonsais(id) ON DELETE SET NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS abonos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nombre VARCHAR(255) NOT NULL,
      tipo VARCHAR(255),
      observaciones TEXT,
      user_id INT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log("Tablas de MySQL verificadas/creadas correctamente.");
  await db.execute(`DROP TABLE IF EXISTS cuidados_bonsai`); // Eliminamos la tabla antigua si existe
};

await createTables();

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
  const userRole = req.user.role;
  const userId = req.user.id;

  // Los moderadores ven todos los bonsáis de todos los usuarios.
  if (userRole === 'moderator') {
    const [bonsais] = await db.query(`
      SELECT b.*, u.email as owner_email 
      FROM bonsais b 
      JOIN users u ON b.user_id = u.id`);
    return res.json(bonsais || []);
  }

  // Los usuarios normales ('user') y los administradores ('admin') solo ven sus propios bonsáis.
  const [bonsais] = await db.query("SELECT * FROM bonsais WHERE user_id = ?", [userId]);
  return res.json(bonsais || []);
});

// Obtener un bonsái específico por ID
app.get("/api/bonsais/:id", protect, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const [[bonsai]] = await db.query(`
    SELECT 
      b.*,
      m.id as maceta_id,
      m.ancho as maceta_ancho,
      m.largo as maceta_largo,
      m.profundo as maceta_profundo,
      a.nombre as abono_nombre
    FROM bonsais b
    LEFT JOIN macetas m ON b.id = m.bonsai_id
    LEFT JOIN abonos a ON b.abono_id = a.id
    WHERE b.id = ?`, [id]);

  if (!bonsai) {
    return res.status(404).json({ message: "Bonsái no encontrado." });
  }

  // Un usuario normal solo puede ver sus propios bonsáis.
  if (user.role === 'user' && bonsai.user_id !== user.id) {
    return res.status(403).json({ message: "No tienes permiso para ver este bonsái." });
  }

  // Si el usuario es admin o moderador, añadimos el email del dueño para que se pueda mostrar en el frontend.
  if (user.role === 'admin' || user.role === 'moderator') {
    const [[owner]] = await db.query("SELECT email FROM users WHERE id = ?", [bonsai.user_id]);
    bonsai.owner_email = owner ? owner.email : 'Desconocido';
  }

  res.json(bonsai);
});

// Crear un bonsái con imagen
app.post("/api/bonsais", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { nombre, especie, edad, fecha_riego, procedencia, abono_id } = req.body;
  const foto = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.user.id;

  const [result] = await db.execute(
    "INSERT INTO bonsais (nombre, especie, edad, fecha_ultimo_trabajo, foto, user_id, procedencia, abono_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [nombre, especie, edad, fecha_riego || null, foto, userId, procedencia, abono_id || null]
  );

  res.json({ id: result.insertId, foto });
});

// Actualizar bonsái
app.put("/api/bonsais/:id", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const { nombre, especie, edad, fecha_riego, procedencia, abono_id } = req.body;
  let foto = req.file ? `/uploads/${req.file.filename}` : null;

  if (!foto) {
    const [[existing]] = await db.query("SELECT foto FROM bonsais WHERE id = ?", [id]);
    foto = existing.foto;
  }

  await db.execute(
    "UPDATE bonsais SET nombre=?, especie=?, edad=?, fecha_ultimo_trabajo=?, foto=?, procedencia=?, abono_id=? WHERE id=? AND user_id = ?",
    [nombre, especie, edad, fecha_riego || null, foto, procedencia, abono_id || null, id, req.user.id]
  );

  res.json({ success: true });
});

// Eliminar bonsái
app.delete("/api/bonsais/:id", protect, async (req, res) => {
  try {
    const { id } = req.params; // ID del bonsái a eliminar
    const user = req.user; // Usuario que realiza la acción

    // Primero, obtenemos el bonsái para verificar permisos
    const [[bonsaiToDelete]] = await db.query("SELECT user_id, foto FROM bonsais WHERE id = ?", [id]);

    if (!bonsaiToDelete) {
      return res.status(404).json({ message: "Bonsái no encontrado." });
    }

    // Lógica de permisos
    if (user.role === 'user' && bonsaiToDelete.user_id !== user.id) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este bonsái." });
    }

    if (user.role === 'moderator') {
      const [[owner]] = await db.query("SELECT role FROM users WHERE id = ?", [bonsaiToDelete.user_id]);
      if (owner && owner.role === 'admin') {
        return res.status(403).json({ message: "Los moderadores no pueden eliminar bonsáis de administradores." });
      }
    }

    // Si se superan las validaciones, procedemos a eliminar
    if (bonsaiToDelete.foto) {
      const imgPath = path.join(__dirname, bonsaiToDelete.foto);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await db.execute("DELETE FROM bonsais WHERE id = ?", [id]);
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

  const [[userExists]] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  if (userExists) {
    return res.status(400).json({ message: "El usuario ya existe" });
  }

  // Asignar rol de admin si el email es el del administrador
  const role = email === 'jmforte63@gmail.com' ? 'admin' : 'user';
  const status = email === 'jmforte63@gmail.com' ? 'approved' : 'pending';

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const [result] = await db.execute("INSERT INTO users (email, password, role, status) VALUES (?, ?, ?, ?)", [email, hashedPassword, role, status]);
  res.status(201).json({ id: result.insertId, email });
});

// Iniciar sesión (autenticar usuario)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const [[user]] = await db.query("SELECT id, email, password, role, status, foto_perfil FROM users WHERE email = ?", [email]);

  if (user && (await bcrypt.compare(password, user.password))) {    
    // Si el usuario no es admin y su cuenta no está aprobada, denegar acceso.
    if (user.role !== 'admin' && user.status !== 'approved') {
      return res.status(403).json({ message: "Tu cuenta está pendiente de aprobación por un administrador." });
    }

    // Generar token
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, foto_perfil: user.foto_perfil }, JWT_SECRET, {
      expiresIn: "1d", // El token expira en 1 día
    });
    res.json({
      id: user.id,
      role: user.role,
      email: user.email,
      foto_perfil: user.foto_perfil,
      token: token,
    });
  } else {
    res.status(401).json({ message: "Email o contraseña inválidos" });
  }
});

// --- API para Perfil de Usuario ---

// Obtener datos del perfil del usuario actual
app.get("/api/perfil", protect, async (req, res) => {
  const [[user]] = await db.query("SELECT id, email, role, foto_perfil FROM users WHERE id = ?", [req.user.id]);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }
  res.json(user);
});

// Actualizar foto de perfil
app.put("/api/perfil/foto", protect, upload.single('foto_perfil'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No se ha subido ninguna imagen." });
  }

  const newPhotoPath = `/uploads/${req.file.filename}`;
  const userId = req.user.id;

  try {
    // 1. Obtener la foto antigua para borrarla del sistema de archivos
    const [[user]] = await db.query("SELECT foto_perfil FROM users WHERE id = ?", [userId]);
    if (user && user.foto_perfil) {
      const oldPath = path.join(__dirname, user.foto_perfil);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // 2. Actualizar la base de datos con la nueva ruta de la foto
    await db.execute("UPDATE users SET foto_perfil = ? WHERE id = ?", [newPhotoPath, userId]);

    res.json({ success: true, foto_perfil: newPhotoPath });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la foto de perfil." });
  }
});

// --- API para Administración ---

// Obtener estadísticas generales (solo para admins)
app.get("/api/admin/stats", protect, isAdmin, async (req, res) => {
  try {
    const [[userStats]] = await db.query("SELECT COUNT(*) as count FROM users");
    const [[bonsaiStats]] = await db.query("SELECT COUNT(*) as count FROM bonsais");

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
  const [users] = await db.query("SELECT id, email, status, role FROM users WHERE id <> ?", [req.user.id]);
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
  const [[userToUpdate]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
  if (userToUpdate && userToUpdate.role === 'admin') {
      return res.status(403).json({ message: "No se puede cambiar el estado de un administrador." });
  }

  await db.execute("UPDATE users SET status = ? WHERE id = ?", [status, id]);
  // Devolvemos la lista de usuarios actualizada para evitar una segunda llamada desde el frontend
  const [users] = await db.query("SELECT id, email, status, role FROM users WHERE id <> ?", [req.user.id]);
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
  const [[userToUpdate]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
  if (userToUpdate && userToUpdate.role === 'admin') {
      return res.status(403).json({ message: "No se puede cambiar el rol de un administrador." });
  }

  await db.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);

  // Devolvemos la lista de usuarios actualizada para evitar una segunda llamada desde el frontend
  const [users] = await db.query("SELECT id, email, status, role FROM users WHERE id <> ?", [req.user.id]);
  res.json(users);
});

// Eliminar un usuario por su ID
app.delete("/api/admin/user/:id", protect, isAdmin, async (req, res) => {
  const { id } = req.params;

  // Medida de seguridad: Prevenir que un admin se elimine a sí mismo o a otro admin.
  const [[userToDelete]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
  if (!userToDelete) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }
  if (userToDelete.role === 'admin') {
    return res.status(403).json({ message: "No se puede eliminar a un administrador." });
  }

  await db.execute("DELETE FROM users WHERE id = ?", [id]);

  // Devolvemos la lista de usuarios actualizada para que el frontend se refresque.
  const [users] = await db.query("SELECT id, email, status, role FROM users WHERE id <> ?", [req.user.id]);
  res.json(users);
});


// --- API para Trabajos ---

// Obtener todos los trabajos
app.get("/api/trabajos", protect, async (req, res) => {
  const [trabajos] = await db.query("SELECT * FROM trabajos ORDER BY fecha DESC");
  res.json(trabajos);
});

// Crear un nuevo trabajo
app.post("/api/trabajos", protect, blockWriteAccessForModerator, async (req, res) => {
  const { tipo_trabajo, fecha } = req.body;

  // Verificación manual para evitar duplicados
  const [[existing]] = await db.query("SELECT id FROM trabajos WHERE tipo_trabajo = ?", [tipo_trabajo]);
  if (existing) {
    return res.status(409).json({ message: "Esa técnica de bonsái ya existe." });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO trabajos (tipo_trabajo, fecha) VALUES (?, ?)",
      [tipo_trabajo, fecha]
    );
    res.status(201).json({ id: result.insertId, tipo_trabajo });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Esa técnica de bonsái ya existe." });
    }
    res.status(500).json({ message: "Error al crear la técnica." });
  }
});

// Actualizar un trabajo
app.put("/api/trabajos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { tipo_trabajo, fecha } = req.body;

  // Verificación manual para evitar duplicados al actualizar
  const [[existing]] = await db.query("SELECT id FROM trabajos WHERE tipo_trabajo = ? AND id != ?", [tipo_trabajo, id]);
  if (existing) {
    return res.status(409).json({ message: "Ese nombre de técnica ya está en uso." });
  }

  try {
    await db.execute("UPDATE trabajos SET tipo_trabajo = ?, fecha = ? WHERE id = ?", [tipo_trabajo, fecha, id]);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Ese nombre de técnica ya está en uso." });
    }
    res.status(500).json({ message: "Error al actualizar la técnica." });
  }
});

// Eliminar un trabajo
app.delete("/api/trabajos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  await db.execute("DELETE FROM trabajos WHERE id = ?", [id]);
  res.json({ success: true });
});

// --- API para Procedencias ---

// Obtener todas las procedencias
app.get("/api/procedencias", protect, async (req, res) => {
  const [procedencias] = await db.query("SELECT * FROM procedencias ORDER BY nombre");
  res.json(procedencias);
});

// Crear una nueva procedencia (solo admin)
app.post("/api/procedencias", protect, blockWriteAccessForModerator, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es requerido." });
  try {
    const [result] = await db.execute("INSERT INTO procedencias (nombre) VALUES (?)", [nombre]);
    res.status(201).json({ id: result.insertId, nombre });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Esa procedencia ya existe." }); // 409 Conflict
    }
    res.status(500).json({ message: "Error al crear la procedencia." });
  }
});

// Eliminar una procedencia (solo admin)
app.delete("/api/procedencias/:id", protect, isAdmin, async (req, res) => {
  await db.execute("DELETE FROM procedencias WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// Actualizar una procedencia (solo admin)
app.put("/api/procedencias/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es requerido." });
  try {
    await db.execute("UPDATE procedencias SET nombre = ? WHERE id = ?", [nombre, id]);
    res.json({ id: parseInt(id, 10), nombre });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: "Ese nombre de procedencia ya está en uso." });
    }
    res.status(500).json({ message: "Error al actualizar la procedencia." });
  }
});

// --- API para Tareas Pendientes ---

// Obtener todas las tareas de un bonsái específico
app.get("/api/bonsais/:id/tareas", protect, async (req, res) => {
    const { id } = req.params;
    const [[bonsai]] = await db.query("SELECT user_id FROM bonsais WHERE id = ?", [id]);
    if (!bonsai) {
        return res.status(404).json({ message: "Bonsái no encontrado." });
    }
    if (req.user.role === 'user' && bonsai.user_id !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para ver las tareas de este bonsái." });
    }

    const [tareas] = await db.query("SELECT * FROM tareas_pendientes WHERE bonsai_id = ? ORDER BY completada ASC, fecha_creacion DESC", [id]);
    res.json(tareas);
});

// Crear una nueva tarea para un bonsái
app.post("/api/bonsais/:id/tareas", protect, blockWriteAccessForModerator, async (req, res) => {
    const bonsai_id = req.params.id;
    const { descripcion, fecha_limite, observaciones } = req.body;
    if (!descripcion) {
        return res.status(400).json({ message: "La descripción es requerida." });
    }
    // Formateamos la fecha al formato 'YYYY-MM-DD HH:MM:SS' que MySQL espera para DATETIME
    const fecha_creacion = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await db.execute(
        "INSERT INTO tareas_pendientes (bonsai_id, descripcion, fecha_creacion, fecha_limite, observaciones) VALUES (?, ?, ?, ?, ?)",
        [bonsai_id, descripcion, fecha_creacion, fecha_limite || null, observaciones || null]
    );
    res.status(201).json({ id: result.insertId, bonsai_id, descripcion, completada: 0, fecha_creacion, fecha_limite, observaciones });
});

// Actualizar una tarea (marcar como completada/pendiente)
app.put("/api/tareas/:id", protect, blockWriteAccessForModerator, async (req, res) => {
    const { id } = req.params;
    const { completada } = req.body;

    if (typeof completada === 'undefined') {
        return res.status(400).json({ message: "El estado 'completada' es requerido." });
    }

    await db.execute("UPDATE tareas_pendientes SET completada = ? WHERE id = ?", [completada ? 1 : 0, id]);
    const [[tareaActualizada]] = await db.query("SELECT * FROM tareas_pendientes WHERE id = ?", [id]);
    res.json(tareaActualizada);
});

// Eliminar una tarea pendiente
app.delete("/api/tareas/:id", protect, async (req, res) => {
    const { id } = req.params;
    // Aquí podrías añadir una lógica de permisos similar a la de eliminar trabajos si fuera necesario
    const [result] = await db.execute("DELETE FROM tareas_pendientes WHERE id = ?", [id]);
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
        const [[tarea]] = await db.query("SELECT * FROM tareas_pendientes WHERE id = ?", [id]);
        if (!tarea) {
            return res.status(404).json({ message: "Tarea no encontrada." });
        }

        // 2. Encontrar el 'trabajo_id' correspondiente a la descripción de la tarea
        // Usamos LOWER() para que la comparación no distinga entre mayúsculas y minúsculas.
        const [[trabajo]] = await db.query("SELECT id FROM trabajos WHERE LOWER(tipo_trabajo) = LOWER(?)", [tarea.descripcion]);
        if (!trabajo) {
            // Devolvemos un 404 para ser más específicos, ya que el recurso "tipo de trabajo" no se encontró.
            return res.status(404).json({ message: `El tipo de trabajo "${tarea.descripcion}" no existe. Por favor, créalo en la sección 'Técnicas de Bonsái' antes de mover la tarea.` });
        }

        // 3. Crear una nueva entrada en 'trabajos_bonsai'
        const fechaRealizacion = new Date().toISOString().split('T')[0]; // Fecha actual
        await db.execute(
            "INSERT INTO trabajos_bonsai (bonsai_id, trabajo_id, fecha, observaciones) VALUES (?, ?, ?, ?)",
            [tarea.bonsai_id, trabajo.id, fechaRealizacion, tarea.observaciones]
        );

        // 4. Eliminar la tarea de 'tareas_pendientes'
        await db.execute("DELETE FROM tareas_pendientes WHERE id = ?", [id]);

        // 5. Actualizar la fecha del último trabajo en la tabla de bonsais
        await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = ? WHERE id = ?", [fechaRealizacion, tarea.bonsai_id]);

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
    const [trabajosRealizados] = await db.query(`
        SELECT tb.id, tb.fecha, tb.foto_antes, tb.foto_despues, t.tipo_trabajo, tb.trabajo_id, tb.observaciones, tb.abono_id, a.nombre as abono_nombre
        FROM trabajos_bonsai tb
        JOIN trabajos t ON tb.trabajo_id = t.id
        LEFT JOIN abonos a ON tb.abono_id = a.id
        WHERE tb.bonsai_id = ?
        ORDER BY tb.fecha DESC, tb.id DESC
    `, [id]);
    res.json(trabajosRealizados);
});

// Añadir un nuevo trabajo a un bonsái (con antes y después)
app.post("/api/trabajos_bonsai", protect, blockWriteAccessForModerator, upload.fields([
  { name: 'foto_antes', maxCount: 1 },
  { name: 'foto_despues', maxCount: 1 }
]), async (req, res) => {
  const { bonsai_id, trabajo_id, fecha, observaciones, abono_id } = req.body;
  const foto_antes = req.files['foto_antes'] ? `/uploads/${req.files['foto_antes'][0].filename}` : null;
  const foto_despues = req.files['foto_despues'] ? `/uploads/${req.files['foto_despues'][0].filename}` : null;

  const [result] = await db.execute(
    "INSERT INTO trabajos_bonsai (bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones, abono_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones, abono_id || null]
  );

  // Actualizamos la fecha del último trabajo en la tabla de bonsais
  await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = ? WHERE id = ?", [fecha, bonsai_id]);

  res.json({ id: result.insertId });
});

// Crear un trabajo en el historial a partir de una tarea pendiente
app.post("/api/trabajos_bonsai/from-task/:taskId", protect, blockWriteAccessForModerator, upload.fields([
  { name: 'foto_antes', maxCount: 1 },
  { name: 'foto_despues', maxCount: 1 }
]), async (req, res) => {
  const { taskId } = req.params;
  const { trabajo_id, fecha, observaciones, abono_id } = req.body;

  try {
    // 1. Obtener la tarea para asegurarse de que existe y obtener el bonsai_id
    const [[tarea]] = await db.query("SELECT bonsai_id FROM tareas_pendientes WHERE id = ?", [taskId]);
    if (!tarea) {
      return res.status(404).json({ message: "La tarea original no fue encontrada." });
    }

    // 2. Crear la nueva entrada en trabajos_bonsai
    const foto_antes = req.files['foto_antes'] ? `/uploads/${req.files['foto_antes'][0].filename}` : null;
    const foto_despues = req.files['foto_despues'] ? `/uploads/${req.files['foto_despues'][0].filename}` : null;

    await db.execute(
      "INSERT INTO trabajos_bonsai (bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones, abono_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tarea.bonsai_id, trabajo_id, fecha, foto_antes, foto_despues, observaciones, abono_id || null]
    );

    // 3. Eliminar la tarea pendiente
    await db.execute("DELETE FROM tareas_pendientes WHERE id = ?", [taskId]);

    // 4. Actualizar la fecha del último trabajo en la tabla de bonsais
    await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = ? WHERE id = ?", [fecha, tarea.bonsai_id]);

    res.status(201).json({ success: true, message: "Trabajo creado y tarea eliminada con éxito." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor al procesar la tarea." });
  }
});

// Eliminar un trabajo de un bonsái
app.delete("/api/trabajos_bonsai/:id", protect, async (req, res) => {
  try {
    const { id } = req.params; // ID del trabajo_bonsai a eliminar
    const user = req.user; // Usuario que realiza la acción

    // Obtenemos el trabajo y el rol del dueño del bonsái asociado
    const [[jobInfo]] = await db.query(`
      SELECT tb.foto_antes, tb.foto_despues, tb.bonsai_id, b.user_id as owner_id, u.role as owner_role
      FROM trabajos_bonsai tb
      JOIN bonsais b ON tb.bonsai_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE tb.id = ?
    `, [id]);

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
    const [[newLatestJob]] = await db.query(
      "SELECT fecha FROM trabajos_bonsai WHERE bonsai_id = ? AND id != ? ORDER BY fecha DESC LIMIT 1",
      [jobInfo.bonsai_id, id]
    );

    // Si encontramos un nuevo trabajo más reciente, actualizamos la fecha.
    // Si no quedan trabajos, podríamos poner la fecha a null o dejarla como estaba.
    // Por ahora, la actualizamos si existe un nuevo trabajo.
    if (newLatestJob) {
      await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = ? WHERE id = ?", [newLatestJob.fecha, jobInfo.bonsai_id]);
    } else {
      // Opcional: si no quedan trabajos, podríamos limpiar la fecha.
      await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = NULL WHERE id = ?", [jobInfo.bonsai_id]);
    }

    await db.execute("DELETE FROM trabajos_bonsai WHERE id = ?", [id]);
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
  const { trabajo_id, fecha, observaciones, abono_id } = req.body;

  // Obtener el registro existente para saber las fotos actuales
  const [[existing]] = await db.query("SELECT foto_antes, foto_despues, observaciones, bonsai_id, abono_id FROM trabajos_bonsai WHERE id = ?", [id]);

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

  await db.execute(
    "UPDATE trabajos_bonsai SET trabajo_id = ?, fecha = ?, foto_antes = ?, foto_despues = ?, observaciones = ?, abono_id = ? WHERE id = ?",
    [trabajo_id, fecha, foto_antes, foto_despues, observaciones, abono_id || null, id]
  );

  // Actualizamos la fecha del último trabajo en la tabla de bonsais
  await db.execute("UPDATE bonsais SET fecha_ultimo_trabajo = ? WHERE id = ?", [fecha, existing.bonsai_id]);
  res.json({ success: true });
});

// --- API para Cuidados Específicos del Bonsái ---

// Obtener los cuidados para la especie de un bonsái
app.get("/api/bonsais/:id/cuidados", protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // 1. Obtener la especie del bonsái
    const [[bonsai]] = await db.query("SELECT especie FROM bonsais WHERE id = ? AND user_id = ?", [id, userId]);
    if (!bonsai) {
      return res.status(404).json({ message: "Bonsái no encontrado o no te pertenece." });
    }
    // 2. Buscar el plan de cuidados para esa especie y usuario
    const [[cuidados]] = await db.query("SELECT * FROM cuidados_especie WHERE user_id = ? AND especie = ?", [userId, bonsai.especie]);
    res.json(cuidados || { especie: bonsai.especie, descripcion: '' }); // Devuelve un objeto vacío si no hay cuidados
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los cuidados." });
  }
});

// Crear o actualizar los cuidados para una especie
app.post("/api/bonsais/:id/cuidados", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { descripcion } = req.body;
  const userId = req.user.id;
  try {
    const [[bonsai]] = await db.query("SELECT especie FROM bonsais WHERE id = ? AND user_id = ?", [id, userId]);
    if (!bonsai) {
      return res.status(404).json({ message: "Bonsái no encontrado o no te pertenece." });
    }
    const query = `
      INSERT INTO cuidados_especie (user_id, especie, descripcion) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)
    `;
    await db.execute(query, [userId, bonsai.especie, descripcion]);
    res.json({ success: true, message: "Cuidados guardados correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar los cuidados." });
  }
});

// Eliminar los cuidados de una especie
app.delete("/api/bonsais/:id/cuidados", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const [[bonsai]] = await db.query("SELECT especie FROM bonsais WHERE id = ? AND user_id = ?", [id, userId]);
    if (!bonsai) return res.status(404).json({ message: "Bonsái no encontrado." });
    await db.execute("DELETE FROM cuidados_especie WHERE user_id = ? AND especie = ?", [userId, bonsai.especie]);
    res.json({ success: true, message: "Cuidados eliminados correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar los cuidados." });
  }
});

// --- API para "Mis Especies" (Fichas de Cuidados Globales) ---

// Obtener todas las fichas de especies del usuario
app.get("/api/species", protect, async (req, res) => {
  try {
    const [species] = await db.query("SELECT * FROM cuidados_especie WHERE user_id = ? ORDER BY especie ASC", [req.user.id]);
    res.json(species);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las fichas de especies." });
  }
});

// Crear una nueva ficha de especie
app.post("/api/species", protect, blockWriteAccessForModerator, async (req, res) => {
  const { especie, descripcion } = req.body;
  if (!especie) {
    return res.status(400).json({ message: "El nombre de la especie es requerido." });
  }
  try {
    const query = `
      INSERT INTO cuidados_especie (user_id, especie, descripcion) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)
    `;
    const [result] = await db.execute(query, [req.user.id, especie, descripcion]);
    const [[newSpecies]] = await db.query("SELECT * FROM cuidados_especie WHERE id = ?", [result.insertId]);
    res.status(201).json(newSpecies);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la ficha de especie." });
  }
});

// Actualizar una ficha de especie
app.put("/api/species/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { especie, descripcion } = req.body;
  if (!especie) {
    return res.status(400).json({ message: "El nombre de la especie es requerido." });
  }
  const [result] = await db.execute(
    "UPDATE cuidados_especie SET especie = ?, descripcion = ? WHERE id = ? AND user_id = ?",
    [especie, descripcion, id, req.user.id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Ficha no encontrada o sin permisos para editar." });
  }
  res.json({ success: true });
});

// Eliminar una ficha de especie
app.delete("/api/species/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  await db.execute("DELETE FROM cuidados_especie WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.json({ success: true });
});

// --- API para Macetas ---

// Obtener todas las macetas del usuario
app.get("/api/macetas", protect, async (req, res) => {
  const [macetas] = await db.query(`
    SELECT m.*, b.nombre as bonsai_nombre 
    FROM macetas m
    LEFT JOIN bonsais b ON m.bonsai_id = b.id
    WHERE m.user_id = ? ORDER BY m.id DESC
  `, [req.user.id]);
  res.json(macetas);
});

// Crear una nueva maceta
app.post("/api/macetas", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { ancho, largo, profundo } = req.body;
  const foto = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.user.id;

  const [result] = await db.execute(
    "INSERT INTO macetas (ancho, largo, profundo, foto, user_id) VALUES (?, ?, ?, ?, ?)",
    [ancho, largo, profundo, foto, userId]
  );
  res.status(201).json({ id: result.insertId, foto, ancho, largo, profundo, libre: true });
});

// Actualizar una maceta
app.put("/api/macetas/:id", protect, blockWriteAccessForModerator, upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const { ancho, largo, profundo, bonsai_id } = req.body;
  let foto = req.file ? `/uploads/${req.file.filename}` : null;

  const [[maceta]] = await db.query("SELECT foto, user_id FROM macetas WHERE id = ?", [id]);
  if (!maceta || maceta.user_id !== req.user.id) {
    return res.status(403).json({ message: "No tienes permiso para editar esta maceta." });
  }

  if (!foto) {
    foto = maceta.foto;
  } else if (maceta.foto) {
    // Borrar foto antigua si se sube una nueva
    const oldPath = path.join(__dirname, maceta.foto);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Lógica de asignación de bonsái
  const nuevoBonsaiId = bonsai_id && bonsai_id !== 'null' ? parseInt(bonsai_id, 10) : null;
  const libre = nuevoBonsaiId === null;

  // Si se está asignando un nuevo bonsái, liberar cualquier otra maceta que lo tuviera
  if (nuevoBonsaiId) {
    await db.execute(
      "UPDATE macetas SET bonsai_id = NULL, libre = true WHERE bonsai_id = ? AND id != ?",
      [nuevoBonsaiId, id]
    );
  }

  await db.execute(
    "UPDATE macetas SET ancho=?, largo=?, profundo=?, foto=?, bonsai_id=?, libre=? WHERE id=? AND user_id=?",
    [ancho, largo, profundo, foto, nuevoBonsaiId, libre, id, req.user.id]
  );

  res.json({ success: true });
});

// Eliminar una maceta
app.delete("/api/macetas/:id", protect, async (req, res) => {
  const { id } = req.params;
  const [[maceta]] = await db.query("SELECT foto, user_id FROM macetas WHERE id = ?", [id]);

  if (!maceta || (req.user.role === 'user' && maceta.user_id !== req.user.id)) {
    return res.status(403).json({ message: "No tienes permiso para eliminar esta maceta." });
  }

  // Eliminar la imagen asociada
  if (maceta.foto) {
    const imgPath = path.join(__dirname, maceta.foto);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  await db.execute("DELETE FROM macetas WHERE id = ?", [id]);
  res.json({ success: true });
});

// --- API para obtener datos para filtros de la Galería ---
app.get("/api/gallery/filters", protect, async (req, res) => {
  try {
    const [species] = await db.query("SELECT DISTINCT especie FROM bonsais ORDER BY especie ASC");
    const [users] = await db.query("SELECT DISTINCT email FROM users ORDER BY email ASC");

    res.json({
      species: species.map(s => s.especie),
      users: users.map(u => u.email),
    });
  } catch (error) {
    console.error("Error al obtener los filtros de la galería:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// --- API para Galería Global ---
app.get("/api/gallery", protect, async (req, res) => {
  try {
    const { species, sortBy = 'fecha', sortOrder = 'DESC' } = req.query;
    let params = [];

    let query = `
      SELECT 
        tb.id, tb.fecha, tb.foto_antes, tb.foto_despues, 
        b.nombre as bonsai_nombre, b.especie, u.email as owner_email
      FROM trabajos_bonsai tb
      JOIN bonsais b ON tb.bonsai_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE tb.foto_antes IS NOT NULL AND tb.foto_despues IS NOT NULL
    `;

    const whereClauses = [];

    if (req.user.role === 'user') {
      whereClauses.push("b.user_id = ?");
      params.push(req.user.id);
    }

    if (species) {
      whereClauses.push("b.especie = ?");
      params.push(species);
    }

    if (whereClauses.length > 0) {
      query += ` AND ${whereClauses.join(' AND ')}`;
    }

    // Whitelist para evitar inyección SQL en ORDER BY
    const validSortBy = { 'fecha': 'tb.fecha', 'nombre': 'b.nombre' };
    const validSortOrder = { 'ASC': 'ASC', 'DESC': 'DESC' };
    const orderBy = validSortBy[sortBy] || 'tb.fecha';
    const orderDirection = validSortOrder[sortOrder] || 'DESC';

    query += ` ORDER BY ${orderBy} ${orderDirection}`;

    const [galleryItems] = await db.query(query, params);
    res.json(galleryItems);

  } catch (error) {
    console.error("Error al obtener la galería:", error);
    res.status(500).json({ message: "Error interno del servidor al obtener la galería." });
  }
});

// --- API para el Calendario Unificado ---
app.get("/api/calendar/events", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. Obtener trabajos realizados (historial)
    const trabajosQuery = `
      SELECT
        tb.fecha as start,
        CONCAT('✓ ', b.nombre, ' - ', t.tipo_trabajo) as title,
        '#27ae60' as backgroundColor,
        '#ffffff' as textColor,
        CONCAT('/bonsai_detalle.html?id=', b.id) as url,
        b.user_id
    FROM trabajos_bonsai tb
    JOIN bonsais b ON tb.bonsai_id = b.id
    JOIN trabajos t ON tb.trabajo_id = t.id
    `;
    const [trabajosRealizados] = await db.query(trabajosQuery);

    // 2. Obtener tareas pendientes
    const tareasQuery = `
      SELECT
        tp.fecha_limite as start,
        CONCAT('! ', b.nombre, ' - ', tp.descripcion) as title,
        '#c0392b' as backgroundColor,
        '#ffffff' as textColor,
        CONCAT('/bonsai_detalle.html?id=', b.id) as url,
        b.user_id
    FROM tareas_pendientes tp
    JOIN bonsais b ON tp.bonsai_id = b.id
    WHERE tp.fecha_limite IS NOT NULL AND tp.completada = false
    `;
    const [tareasPendientes] = await db.query(tareasQuery);

    // 3. Combinar ambos resultados
    const allEvents = [...trabajosRealizados, ...tareasPendientes];

    // 4. Aplicar el filtro de permisos
    const filteredEvents = (userRole === 'user' || userRole === 'admin')
      ? allEvents.filter(e => e.user_id === userId)
      : allEvents; // El moderador ve todo

    res.json(filteredEvents);
  } catch (error) {
    console.error("Error al obtener las tareas pendientes del calendario:", error);
    res.status(500).json({ message: "Error interno del servidor al obtener las tareas pendientes del calendario." });
  }
});

// --- API para Notificaciones ---
app.get("/api/notifications/pending-count", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query;
    let params = [];

    const baseQuery = `      SELECT 
        tp.descripcion,
        tp.fecha_limite,
        b.nombre as bonsai_nombre,
        b.id as bonsai_id
      FROM tareas_pendientes tp
      JOIN bonsais b ON tp.bonsai_id = b.id
      WHERE tp.completada = false
      AND tp.fecha_limite IS NOT NULL
      AND tp.fecha_limite <= CURDATE()
    `;

    if (userRole === 'user' || userRole === 'admin') {
      query = `${baseQuery} AND b.user_id = ? ORDER BY tp.fecha_limite ASC`;
      params = [userId];
    } else { // moderator
      query = `${baseQuery} ORDER BY tp.fecha_limite ASC`;
    }

    const [tasks] = await db.query(query, params);
    res.json(tasks);
  } catch (error) {
    console.error("Error al obtener el conteo de notificaciones:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// --- API para Abonos ---

// Obtener todos los abonos del usuario
app.get("/api/abonos", protect, async (req, res) => {
  const [abonos] = await db.query("SELECT * FROM abonos WHERE user_id = ? ORDER BY nombre", [req.user.id]);
  res.json(abonos);
});

// Crear un nuevo abono
app.post("/api/abonos", protect, blockWriteAccessForModerator, async (req, res) => {
  const { nombre, tipo, observaciones } = req.body;
  const userId = req.user.id;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre del abono es requerido." });
  }

  const [result] = await db.execute(
    "INSERT INTO abonos (nombre, tipo, observaciones, user_id) VALUES (?, ?, ?, ?)",
    [nombre, tipo, observaciones, userId]
  );
  res.status(201).json({ id: result.insertId, nombre, tipo, observaciones, user_id: userId });
});

// Actualizar un abono
app.put("/api/abonos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, observaciones } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre del abono es requerido." });
  }

  const [result] = await db.execute(
    "UPDATE abonos SET nombre = ?, tipo = ?, observaciones = ? WHERE id = ? AND user_id = ?",
    [nombre, tipo, observaciones, id, req.user.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Abono no encontrado o no tienes permiso para editarlo." });
  }

  res.json({ success: true });
});

// Eliminar un abono
app.delete("/api/abonos/:id", protect, blockWriteAccessForModerator, async (req, res) => {
  const { id } = req.params;
  const [result] = await db.execute("DELETE FROM abonos WHERE id = ? AND user_id = ?", [id, req.user.id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Abono no encontrado o no tienes permiso para eliminarlo." });
  }

  res.json({ success: true });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🌳 Servidor Bonsai corriendo en http://localhost:${PORT}`));
