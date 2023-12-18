const express = require("express");
const socket = require("socket.io");
const forge = require("node-forge");
const multer = require("multer");
const path = require("path");
const util = require("./generatePrime");
const fs = require("fs");

const app = express();
const server = app.listen(3300, () => {
  console.log("Listening at port 3300");
});

app.use(express.static("public"));
app.use(express.static("uploads"));

app.get("/", (req, res) => {
  res.sendFile("public/chat.html", { root: __dirname });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Resimlerin saklanacağı klasör
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage: storage });
const io = socket(server);

app.get("/uploads/:image", (req, res) => {
  const imagePath = path.join(__dirname, "uploads", req.params.image);
  res.sendFile(imagePath);
});

io.on("connection", (socket) => {
  console.log("Conn. established");
  console.log("Socket", socket.id);

  let q, p;
  const bits = 8;
  const a = Math.floor(Math.random() * 9) + 1;
  console.log("a", a);

  [p, q] = util.genPrimes();

  socket.on("request", (data) => {
    console.log("q", q, "p", p);
    socket.emit("request", {
      q: q,
      p: p,
    });
  });

  socket.on("exchange", (data) => {
    console.log("B:", data);
    const B = data;

    const A = Math.pow(q, a) % p;
    const K_a = Math.pow(B, a) % p;

    socket.emit("exchange", {
      K_a: K_a,
      A: A,
    });
  });

  socket.on("chat", (data) => {
    if (data.image) {
      const key = data.key;
      const iv = data.iv;
      const encImage = forge.util.createBuffer(data.image, "raw");

      const decipher = forge.cipher.createDecipher("AES-CBC", key);
      decipher.start({ iv: iv });
      decipher.update(encImage);
      const result = decipher.finish();

      if (result) {
        const decryptedImage = Buffer.from(
          decipher.output.getBytes(),
          "binary"
        );

        const imageName = "./uploads/decrypted_image_" + Date.now() + ".png";
        // Use asynchronous writeFile to avoid blocking the event loop
        fs.promises
          .writeFile(imageName, decryptedImage)
          .then(() => {
            // Broadcast the path to the decrypted image to all sockets
            io.sockets.emit("chat", {
              image: imageName,
              handle: data.handle,
            });
          })
          .catch((error) => {
            console.error("Error writing decrypted image to file:", error);
          });
      } else {
        console.error("Decryption failed for the image!");
      }
    } else {
      const key = data.key;
      const iv = data.iv;

      const encMsg = forge.util.createBuffer(data.message);
      const decipher = forge.cipher.createDecipher("AES-CBC", key);
      decipher.start({ iv: iv });
      decipher.update(encMsg);
      const result = decipher.finish();
      if (result) {
        //const decryptedMsg = decipher.output.toString();
        //data.message = decryptedMsg;
        //console.log(data);
        io.sockets.emit("chat", data);
      } else {
        console.error("Decryption failed for the text message!");
      }
    }
  });

  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });
});
