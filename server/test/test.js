import {exitHandler, server} from '../index.js';

import axios from 'axios';  
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = "http://localhost:3000/chat";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
await delay(1000); 

let chatId;

describe("GET /chat/", () => {
  it("should get all chats", async () => {
    console.log("Running GET " + BASE_URL + "/ test");
    const response = await axios.get(`${BASE_URL}/`);

    assert.ok([200, 204].includes(response.status), `Expected status 200 or 204, but got ${response.status}`);

    if (response.status === 200) {
      assert.ok(Array.isArray(response.data), "Expected response data to be an array");
    }
});
});

describe("POST /chat/", () => {
  it("should create a new chat", async () => {
    const response = await axios.post(`${BASE_URL}/`, {
      name: "Test Chat",
    });

    assert.strictEqual(response.status, 200);
    assert.ok(response.data);

    chatId = response.data;
  });

  it("should create a chat without a name", async () => {
    const response = await axios.post(`${BASE_URL}/`, {});

    assert.strictEqual(response.status, 200);
    assert.ok(response.data);

    // Clean up the chat created by this test.
    await axios.delete(`${BASE_URL}/${response.data}`);
  });
});

describe("PATCH /chat/:id", () => {
  it("should rename a chat", async () => {
    assert.ok(chatId);

    const response = await axios.patch(`${BASE_URL}/${chatId}`, {
      name: "Renamed Jest Chat",
    });

    assert.strictEqual(response.status, 200);
  });

  it("should reject an empty name", async () => {
    assert.ok(chatId);

    try {
      await axios.patch(`${BASE_URL}/${chatId}`, {
        name: "   ",
      });

      throw new Error("Expected request to fail");
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
    }
  });

  it("should not rename a 'New chat' when checkNew is true", async () => {
    const createResponse = await axios.post(`${BASE_URL}/`, {});

    const newChatId = createResponse.data;

    const response = await axios.patch(`${BASE_URL}/${newChatId}`, {
      name: "Should Not Rename",
      checkNew: true,
    });

    assert.strictEqual(response.status, 204);

    // Clean up.
    await axios.delete(`${BASE_URL}/${newChatId}`);
  });
});

describe("GET /chat/:id/messages", () => {
  it("should get messages for a chat", async () => {
    assert.ok(chatId);

    const response = await axios.get(
      `${BASE_URL}/${chatId}/messages`
    );

    assert.ok([200, 204].includes(response.status));

    if (response.status === 200) {
      assert.ok(Array.isArray(response.data));
    }
  });
});

describe("POST /chat/:id/messages", () => {
  it("should add a message to a chat", async () => {
    assert.ok(chatId);

    const response = await axios.post(
      `${BASE_URL}/${chatId}/messages`,
      {
        role: "user",
        content: "Hello from Jest",
      }
    );

    assert.strictEqual(response.status, 200);
  });

  it("should add an assistant message to a chat", async () => {
    assert.ok(chatId);

    const response = await axios.post(
      `${BASE_URL}/${chatId}/messages`,
      {
        role: "assistant",
        content: "Hello from the test server",
      }
    );

    assert.strictEqual(response.status, 200);
  });
});

describe("DELETE /chat/:id/messages/:index", () => {
  it("should delete a message", async () => {
    assert.ok(chatId);

    // Add a message so there is something to delete.
    await axios.post(`${BASE_URL}/${chatId}/messages`, {
      role: "user",
      content: "Message to delete",
    });

    const messagesResponse = await axios.get(
      `${BASE_URL}/${chatId}/messages`
    );

    assert.strictEqual(messagesResponse.status, 200);
    assert.ok(messagesResponse.data.length > 0);

    const index = messagesResponse.data.length - 1;

    const response = await axios.delete(
      `${BASE_URL}/${chatId}/messages/${index}`
    );

    assert.strictEqual(response.status, 200);
  });
});

describe("DELETE /chat/:id", () => {

  it("should delete a chat", async () => {
    assert.ok(chatId);

    const response = await axios.delete(`${BASE_URL}/${chatId}`);

    assert.strictEqual(response.status, 200);
  });

  it("should return 404 for a non-existent chat", async () => {
    assert.ok(chatId);
    try {
      await axios.delete(`${BASE_URL}/6a72913682503a13977714e5`);
      throw new Error("Expected request to fail");
    } catch (error) {
      assert.strictEqual(error.response.status, 404);
    }
  });
});


after(async() => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // delay 1 s 
  exitHandler();
});
