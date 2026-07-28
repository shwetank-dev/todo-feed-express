import { z } from "zod";
import { errorResponseSchema } from "@/errors/error-response.schema.js";
import { authResponseSchema } from "@/modules/auth/auth.dto.js";
import { loginSchema, registerSchema } from "@/modules/auth/auth.validation.js";
import {
  paginatedTodoListsResponseSchema,
  todoListResponseSchema,
  todoResponseSchema,
} from "@/modules/todos/todos.dto.js";
import {
  addTodoSchema,
  createListSchema,
  listTodosQuerySchema,
} from "@/modules/todos/todos.validation.js";
import { userDTO } from "@/modules/users/users.dto.js";

function jsonBody(schema: z.ZodTypeAny) {
  return {
    content: {
      "application/json": {
        schema: z.toJSONSchema(schema),
      },
    },
  };
}

function queryParams(schema: z.ZodTypeAny) {
  const jsonSchema = z.toJSONSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const required = new Set(jsonSchema.required ?? []);

  return Object.entries(jsonSchema.properties ?? {}).map(
    ([name, propSchema]) => ({
      name,
      in: "query",
      required: required.has(name),
      schema: propSchema,
    }),
  );
}

function pathParam(name: string) {
  return { name, in: "path", required: true, schema: { type: "string" } };
}

const errorResponse = jsonBody(errorResponseSchema);
const idParam = [pathParam("id")];
const publicRoute: string[] = [];

export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Todo Feed API", version: "1.0.0" },
  tags: [
    { name: "Auth", description: "Registration, login, and identity" },
    { name: "Lists", description: "Todo lists" },
    { name: "Todos", description: "Todos within a list" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  // Protected by default (requireAuth is the norm across this app) — routes
  // without requireAuth (register/login) opt out below with `security: []`.
  security: [{ bearerAuth: [] as string[] }],
  paths: {
    "/api/lists": {
      post: {
        tags: ["Lists"],
        requestBody: jsonBody(createListSchema),
        responses: {
          "201": jsonBody(todoListResponseSchema),
          "400": errorResponse,
          "401": errorResponse,
        },
      },
      get: {
        tags: ["Lists"],
        parameters: queryParams(listTodosQuerySchema),
        responses: {
          "200": jsonBody(paginatedTodoListsResponseSchema),
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/api/lists/{id}": {
      get: {
        tags: ["Lists"],
        parameters: idParam,
        responses: {
          "200": jsonBody(todoListResponseSchema),
          "401": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/lists/{id}/todos": {
      post: {
        tags: ["Todos"],
        parameters: idParam,
        requestBody: jsonBody(addTodoSchema),
        responses: {
          "201": jsonBody(todoResponseSchema),
          "400": errorResponse,
          "401": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/todos/{id}": {
      patch: {
        tags: ["Todos"],
        parameters: idParam,
        responses: {
          "200": jsonBody(todoResponseSchema),
          "401": errorResponse,
          "404": errorResponse,
        },
      },
      delete: {
        tags: ["Todos"],
        parameters: idParam,
        responses: {
          "200": jsonBody(todoResponseSchema),
          "401": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        security: publicRoute,
        requestBody: jsonBody(registerSchema),
        responses: {
          "201": jsonBody(authResponseSchema),
          "400": errorResponse,
          "409": errorResponse,
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        security: publicRoute,
        requestBody: jsonBody(loginSchema),
        responses: {
          "200": jsonBody(authResponseSchema),
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        responses: {
          "200": jsonBody(userDTO),
          "401": errorResponse,
        },
      },
    },
  },
};
