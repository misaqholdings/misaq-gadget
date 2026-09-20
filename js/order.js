// আপনার নিজের তথ্য এখানে বসান
var NOTIFY_EMAIL = "your-email@gmail.com";
var TELEGRAM_BOT_TOKEN = "8569953644:AAHNeaVuG5jol3lUOQTpKxY6fCAZ9DkOLCc";
var TELEGRAM_CHAT_ID = "5137827121";
var META_PIXEL_ID = "2296738321065012";
var META_CAPI_ACCESS_TOKEN = "এখানে-আপনার-Access-Token-বসান";

// Sheet কলাম নম্বর (A=1, B=2, ...) — নতুন কলাম যোগ করলে এখানেও মিলিয়ে নিন
var COL = {
  TIMESTAMP: 1, PRODUCT: 2, NAME: 3, PHONE: 4, ADDRESS: 5,
  DELIVERY_ZONE: 6, COLOR: 7, QUANTITY: 8, UNIT_PRICE: 9,
  DELIVERY_CHARGE: 10, TOTAL: 11, STATUS: 12, EVENT_ID: 13, CAPI_SENT: 14
};

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.product,
    data.name,
    data.phone,
    data.address,
    data.deliveryZone,
    data.color,
    data.quantity,
    data.unitPrice,
    data.deliveryCharge,
    data.total,
    "Pending",       // Status — আপনি ম্যানুয়ালি বদলাবেন
    data.eventId,    // EventID — Lead event-এর সাথে dedup-এর জন্য
    false            // CAPISent — Purchase এখনো পাঠানো হয়নি
  ]);

  sendEmailNotification(data);
  sendTelegramNotification(data);

  // এখানে "Lead" পাঠানো হচ্ছে — এটা শুধু "অর্ডার এসেছে" বোঝায়,
  // আসল sale confirm করে না। আসল Purchase পাঠানো হবে নিচের
  // handleStatusEdit()-এ, যখন কেউ Status "Delivered" করবে।
  sendMetaCAPI("Lead", {
    product: data.product,
    phone: data.phone,
    total: data.total,
    quantity: data.quantity,
    eventId: data.eventId
  });

  return ContentService
    .createTextOutput(JSON.stringify({ result: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendEmailNotification(data) {
  var subject = "🛒 নতুন অর্ডার — " + data.product;
  var body =
    "নতুন একটি অর্ডার এসেছে:\n\n" +
    "প্রোডাক্ট: " + data.product + "\n" +
    "নাম: " + data.name + "\n" +
    "ফোন: " + data.phone + "\n" +
    "ঠিকানা: " + data.address + "\n" +
    "ডেলিভারি: " + data.deliveryZone + "\n" +
    "কালার: " + data.color + "\n" +
    "পরিমাণ: " + data.quantity + "\n" +
    "মোট: ৳" + data.total + "\n\n" +
    "সময়: " + new Date().toLocaleString();

  try {
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
  }
}

function sendTelegramNotification(data) {
  var message =
    "🛒 নতুন অর্ডার!\n" +
    "প্রোডাক্ট: " + data.product + "\n" +
    "নাম: " + data.name + "\n" +
    "ফোন: " + data.phone + "\n" +
    "ঠিকানা: " + data.address + "\n" +
    "ডেলিভারি: " + data.deliveryZone + "\n" +
    "কালার: " + data.color + "\n" +
    "পরিমাণ: " + data.quantity + "\n" +
    "মোট: ৳" + data.total;

  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = { chat_id: TELEGRAM_CHAT_ID, text: message };
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}

// ---- Meta Conversions API — event_name প্যারামিটার দিয়ে ----
// "Lead" (অর্ডার প্লেস) বা "Purchase" (আসলেই ডেলিভার হয়েছে) দুটোর জন্যই ব্যবহার হয়
function sendMetaCAPI(eventName, data) {
  var url = "https://graph.facebook.com/v20.0/" + META_PIXEL_ID +
    "/events?access_token=" + META_CAPI_ACCESS_TOKEN;

  var hashedPhone = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (data.phone || "").replace(/[^0-9]/g, "")
  ).map(function (b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
  }).join("");

  var payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.eventId,
      action_source: "website",
      user_data: {
        ph: [hashedPhone]
      },
      custom_data: {
        value: data.total,
        currency: "BDT",
        content_ids: [data.product],
        content_type: "product",
        num_items: data.quantity
      }
    }]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log(eventName + " CAPI response: " + response.getContentText());
  } catch (err) {
    Logger.log(eventName + " CAPI error: " + err);
  }
}

// ---- এই ফাংশনটা INSTALLABLE TRIGGER হিসেবে বসাতে হবে (নিচের ধাপ দেখুন) ----
// Status কলামে কেউ "Delivered" লিখলেই আসল Purchase event পাঠাবে,
// একবারই পাঠাবে (CAPISent কলাম দিয়ে ডুপ্লিকেট আটকানো হচ্ছে)।
function handleStatusEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getColumn() !== COL.STATUS) return;

  var newValue = e.value;
  if (newValue !== "Delivered") return;

  var sheet = e.range.getSheet();
  var row = e.range.getRow();

  var alreadySent = sheet.getRange(row, COL.CAPI_SENT).getValue();
  if (alreadySent === true) return; // ডুপ্লিকেট Purchase আটকানো

  var rowData = sheet.getRange(row, 1, 1, COL.CAPI_SENT).getValues()[0];

  sendMetaCAPI("Purchase", {
    product: rowData[COL.PRODUCT - 1],
    phone: rowData[COL.PHONE - 1],
    total: rowData[COL.TOTAL - 1],
    quantity: rowData[COL.QUANTITY - 1],
    eventId: "purchase_" + rowData[COL.EVENT_ID - 1] // Lead-এর থেকে আলাদা ID
  });

  sheet.getRange(row, COL.CAPI_SENT).setValue(true);
}

function testTelegram() {
  sendTelegramNotification({
    product: "Test", name: "Test", phone: "01700000000",
    address: "Test", deliveryZone: "ঢাকার ভিতরে",
    color: "সাদা", quantity: 1, total: 950
  });
}

function testMetaCAPI() {
  sendMetaCAPI("Lead", {
    product: "Test", phone: "01700000000",
    total: 950, quantity: 1, eventId: "test_" + Date.now()
  });
}
