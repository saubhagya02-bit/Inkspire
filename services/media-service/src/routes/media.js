const router = require("express").Router();

const {
  uploadFile,
  uploadMultiple,
  getMyMedia,
  deleteMedia,
  updateMedia,
} = require("../controllers/mediaController");

router.post("/upload", uploadFile);
router.post("/upload/multiple", uploadMultiple);
router.get("/my", getMyMedia);
router.patch("/:id", updateMedia);
router.delete("/:id", deleteMedia);

module.exports = router;