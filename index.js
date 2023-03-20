let express = require("express");
let path = require("path");
let fileUpload = require("express-fileupload");
let htmlToPdf = require("html-pdf");

let fs = require("fs");
let jQuery = require("jquery");
let jsdom = require("jsdom");
const { JSDOM } = jsdom;

let crypto = require("crypto");
const { exit } = require("process");
let Iconv = require("iconv").Iconv;

let app = express();

app.use(fileUpload());

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.post("/decrypt", function (req, res) {
  JSDOM.fromFile("./2022592.htm", {}).then((dom) => {
    let $ = jQuery(dom.window);
    var encrypted = $("input[name*='_viewData']").attr("value");
    try {
      var decryptedFile = decryptPayPaper("1031624", encrypted);

      // hack: force replace 'EUC-KR' => 'UTF-8'
      decryptedFile = decryptedFile.replace("EUC-KR", "UTF-8");

      // send response
      res.send(decryptedFile);
    } catch (e) {
      // console.log(e.message)
      res.send(e.message);
    }
  });
});

app.listen(process.env.PORT || 3000, () => {
    let filePath = process.argv[2];
  JSDOM.fromFile(filePath || "./2022592.htm", {}).then((dom) => {
    let $ = jQuery(dom.window);
    var encrypted = $("input[name*='_viewData']").attr("value");
    try {
      var decrypted = decryptPayPaper("1031624", encrypted);

      // hack: force replace 'EUC-KR' => 'UTF-8'
      decrypted = decrypted.replace("EUC-KR", "UTF-8");
      decrypted = decrypted.replace("otims.tmax.co.kr/images/TO/sign_4115.gif", "https://otims.tmax.co.kr/images/TO/sign_4115.gif");
      decrypted = decrypted.replace(">(서명 또는 인)<", "hidden >(서명 또는 인)<");
      
      htmlToPdf.create(decrypted, { width: "800px", height: "1200px"}).toFile("./result.pdf", (err, res) => {
        if (err) console.log("error : ", err);
        exit(1);
      });
    } catch (e) {
      console.log("error : ", e);
      exit(1);
    }
  });
});

function decryptPayPaper(password, encrypted) {
  // read blob from base64 encoded string
  var blob = Buffer.from(encrypted, "base64");

  // find Initialization Vector, Salt, Content from Encrypted blob
  // ref : http://www.jensign.com/JavaScience/dotnet/DeriveBytes/
  var IV = blob.slice(56 + 2, 56 + 2 + 8);
  var salt = blob.slice(66 + 2, 66 + 2 + 16);

  var content = blob.slice(84 + 4, blob.length);

  // convert password into UNICODE string
  var iconv = new Iconv("utf-8", "UTF-16LE");
  password = Buffer.from(password);
  password = iconv.convert(password);

  var key = hashSaltPassword(salt, password);

  // decrypt
  var decipher = crypto.createDecipheriv("rc2-cbc", key, IV);
  var decrypted1 = decipher.update(content);
  var decrypted2 = decipher.final();

  var decrypted = Buffer.concat([decrypted1, decrypted2]);

  // convert 'decrypted' to utf8 string, from utf-16 Little Endian
  var iconv = new Iconv("UTF-16LE", "utf-8");
  var decryptedUtf8 = iconv.convert(decrypted).toString();

  return decryptedUtf8;
}

function hashSaltPassword(salt, password) {
  const hash = crypto.createHash("SHA1");

  hash.update(password);
  hash.update(salt);

  var saltedKey = hash.digest().slice(0, 16);
  return saltedKey;
}
