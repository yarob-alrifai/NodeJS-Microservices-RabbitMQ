import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

createConnection().then((db) => {
  const productRepository = db.getRepository(Product);

  //   green conect to the rabbitmq service
  amqp.connect("rabbitmq_url", (error0, connection) => {
    if (error0) {
      throw error0;
    }

    // green create channel
    connection.createChannel((error1, channel) => {
      if (error1) {
        throw error1;
      }

      const app = express();

      //   green connect from differant app
      app.use(
        cors({
          origin: ["http://localhost:3000", "http://localhost:8080", "http://localhost:4200"],
        })
      );

      app.use(express.json());

      // green get all products from MySQL
      app.get("/api/products", async (req: Request, res: Response) => {
        const products = await productRepository.find();
        res.json(products);
      });
      // green add new product
      app.post("/api/products", async (req: Request, res: Response) => {
        const product = await productRepository.create(req.body);
        const result = await productRepository.save(product);
        // cool  buffer

        channel.sendToQueue("product_created", Buffer.from(JSON.stringify(result)));
        return res.send(result);
      });
      // green get product
      app.get("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        return res.send(product);
      });
      // orange update product
      app.put("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        productRepository.merge(product, req.body);
        const result = await productRepository.save(product);
        // cool  buffer
        channel.sendToQueue("product_updated", Buffer.from(JSON.stringify(result)));
        return res.send(result);
      });
      // red delete product
      app.delete("/api/products/:id", async (req: Request, res: Response) => {
        const result = await productRepository.delete(req.params.id);
        // cool  buffer

        channel.sendToQueue("product_deleted", Buffer.from(req.params.id));
        return res.send(result);
      });
      // orange update like number
      app.post("/api/products/:id/like", async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        product.likes++;
        const result = await productRepository.save(product);
        return res.send(result);
      });

      console.log("Listening to port: 8000");
      app.listen(8000);

      // fire close the connection with the channel
      process.on("beforeExit", () => {
        console.log("closing");
        connection.close();
      });
    });
  });
});
