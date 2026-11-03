import { Container } from "@/bootstrap/container";
import { runMigrations } from "./migration";

const container = new Container();
runMigrations(container.db)
	.then(() => {
		console.log("Migrations applied successfully.");
		container.dbContext.sqlite.close();
		process.exit(0);
	})
	.catch((err) => {
		console.error("Failed to apply migrations:", err);
		process.exit(1);
	});
