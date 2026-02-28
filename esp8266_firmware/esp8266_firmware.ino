#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// WiFi
const char* ssid = "oppo";
const char* password = "12345678";

// Pinata
const char* pinataUrl = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const char* pinataJWT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmOTI4NGQ5ZS0wMWQzLTQyMTEtOGVjNi0zNzdjZDdhNDUyMDYiLCJlbWFpbCI6Imp1aWNlcnRlY2hub2xvZ3lAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjIyNmZjMGZiNmEwYjA1MmU0ODA2Iiwic2NvcGVkS2V5U2VjcmV0IjoiYWZmNThiMjBiN2FmMjQwZDEyNTY3OWUzOTFlYTNkOTgwYzUwZTg3ZDcxNzYxOTA1YWFiZjk5ZmVhNGZhYzVjNyIsImV4cCI6MTgwMzgxMDY3OX0.qVMModn1FLyPWwsKbFEhAEHUIlXkuVRamtShGdsXrKU";

void setup() {
  Serial.begin(9600);
  randomSeed(analogRead(0));
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
}

void loop() {
  // Generate Data
  int temperature = random(20, 35); // Random temp between 20-35 C
  int humidity = random(40, 70);    // Random humidity between 40-70%

  Serial.print("Data Sample: ");
  Serial.print(temperature); Serial.print(" *C, "); 
  Serial.print(humidity); Serial.println(" H");

  // Wrapping in pinataContent as per Pinata API requirements
  StaticJsonDocument<512> doc;
  JsonObject pinataContent = doc.createNestedObject("pinataContent");
  pinataContent["deviceId"] = "esp8266-monad-01";
  pinataContent["temperature"] = temperature;
  pinataContent["humidity"] = humidity;
  pinataContent["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, pinataUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", pinataJWT);

  Serial.println("Uploading Data to Pinata...");
  int code = http.POST(payload);
  if (code > 0) {
    String response = http.getString();
    Serial.println("Response: " + response); 
  } else {
    Serial.print("HTTP Post failed, error: ");
    Serial.println(http.errorToString(code).c_str());
  }
  http.end();

  delay(15000);
}



