import express from 'express';
import { getComponents } from '../controllers/componentsController.js';
export default function({ pool }) {
  const router = express.Router();
  router.get('/', getComponents(pool));
  // ...other component routes
  return router;
}
