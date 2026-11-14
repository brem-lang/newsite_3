import { createStart } from "@tanstack/react-start";

// Frontend-only build: no server functions or request middleware.
export const startInstance = createStart(() => ({}));
