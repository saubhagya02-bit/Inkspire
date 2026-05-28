const express = require("express");
const router = express.Router();
const axios = require("axios");

// CREATE POST
router.post("/", async (req, res) => {
  try {
    const response = await axios.post(
      "http://post-service:3002/posts",
      req.body,
      {
        headers: {
          Authorization: req.headers.authorization,
          "x-user-id": req.headers["x-user-id"],
          "x-user-role": req.headers["x-user-role"],
        },
      },
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({
      error: "Service unavailable",
      target: "http://post-service:3002/",
      detail: err.message,
    });
  }
});

// GET POSTS
router.get("/", async (req, res) => {
  try {
    const response = await axios.get("http://post-service:3002/posts", {
      headers: {
        Authorization: req.headers.authorization,
      },
      params: req.query,
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

module.exports = router;
