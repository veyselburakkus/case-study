// Make conn.
const socket = io.connect("http://localhost:3300");
let SECURE = false;

let message = document.getElementById("message"),
  handle = document.getElementById("handle"),
  btn = document.getElementById("send"),
  output = document.getElementById("output"),
  feedback = document.getElementById("feedback");

window.onload = () => {
  let body = document.body;

  // Generate b
  const b = Math.floor(Math.random() * 9) + 1;
  // Send request to obtain p & q from server
  socket.emit("request");
  // Receive p & q from server
  socket.on("request", (data) => {
    let { q, p } = data;
    console.log("q", q, "p", p);
    console.log("b", b);

    // Calculate B = q^b mod p
    let B = Math.pow(parseInt(q), b) % parseInt(p);
    console.log("B", B);

    // Send B to server and get K_a, A from server
    socket.emit("exchange", B);
    socket.on("exchange", (data) => {
      let { K_a, A } = data;
      // Calculate K_b = A^b mod p
      const K_b = Math.pow(A, b) % p;
      console.log("K_b", K_b);

      // Check if both keys match
      if (K_a == K_b) {
        SECURE = true;
        alert("Connection secure.");
        socket.emit("secure");
      } else {
        alert("Connection not secure.");
      }
    });
  });
};

btn.addEventListener("click", function () {
  const isImage = document.querySelector('input[type="file"]').files.length > 0;

  if (isImage) {
    // It's an image upload
    const imageFile = document.querySelector('input[type="file"]').files[0];

    const reader = new FileReader();

    reader.onload = function (e) {
      const key = forge.random.getBytesSync(16);
      const iv = forge.random.getBytesSync(16);
      console.log(`Key : ${key}, IV : ${iv}`);

      // Encrypt image data
      const cipher = forge.cipher.createCipher("AES-CBC", key);
      cipher.start({ iv: iv });
      cipher.update(forge.util.createBuffer(e.target.result));
      cipher.finish();
      debugger;
      const encryptedImage = cipher.output.getBytes();

      socket.emit("chat", {
        image: encryptedImage,
        key: key,
        iv: iv,
      });
    };

    reader.readAsArrayBuffer(imageFile);

    document.querySelector('input[type="file"]').value = "";
  } else {
    const key = forge.random.getBytesSync(16);
    const iv = forge.random.getBytesSync(16);
    console.log(`Key : ${key}, IV : ${iv}`);
    // Encrypt message
    const cipher = forge.cipher.createCipher("AES-CBC", key);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(message.value));
    cipher.finish();
    const encryptedMsg = cipher.output.getBytes();
    socket.emit("chat", {
      message: encryptedMsg,
      handle: handle.value,
      key: key,
      iv: iv,
    });
    message.value = "";
    console.log("secure", SECURE);
  }

  message.value = "";
  console.log("secure", SECURE);
});

message.addEventListener("keypress", function () {
  socket.emit("typing", handle.value);
});

// Listen for events
socket.on("chat", function (data) {
  if (data.image) {
    document.getElementById("output").innerHTML +=
      "<div  class='message receiver'> <img src='" + data.image + "'/></div>";
  } else {
    const key = data.key;
    const iv = data.iv;
    // Decrypted message
    const encMsg = forge.util.createBuffer(data.message);
    const decipher = forge.cipher.createDecipher("AES-CBC", key);
    decipher.start({ iv: iv });
    decipher.update(encMsg);
    const result = decipher.finish();
    console.log("Result", result);
    const decryptedMsg = decipher.output.toString();
    feedback.innerHTML = "";
    output.innerHTML +=
      "<div  class='message receiver'><strong>" +
      data.handle +
      ": </strong>" +
      decryptedMsg +
      "</div>";
  }
});

socket.on("typing", function (data) {
  feedback.innerHTML = "<p><em>" + data + " is typing a message...</em></p>";
});
