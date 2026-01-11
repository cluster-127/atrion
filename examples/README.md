# Atrion Examples

Production-ready integration patterns for Atrion v1.1+.

---

## Quick Start

| File                                             | Pattern             | Use Case                        |
| ------------------------------------------------ | ------------------- | ------------------------------- |
| [wrapper-class.ts](./wrapper-class.ts)           | `AtrionGuard` class | Foundation for all integrations |
| [express-middleware.ts](./express-middleware.ts) | Express middleware  | REST APIs with Express          |
| [nestjs-interceptor.ts](./nestjs-interceptor.ts) | NestJS Interceptor  | Enterprise NestJS apps          |

---

## Usage

### 1. Wrapper Class (Foundation)

```typescript
import { AtrionGuard } from './wrapper-class'

const guard = new AtrionGuard({ debug: true })

// Before request
if (!guard.canAccept('api/users')) {
  return res.status(503).json({ error: 'Service unavailable' })
}

// After request
guard.reportOutcome('api/users', { latencyMs: 45, isError: false })
```

### 2. Express Middleware

```typescript
import { createAtrionMiddleware } from './express-middleware'

app.use(createAtrionMiddleware()) // Auto route detection
app.use('/api', createAtrionMiddleware('main-api', { debug: true }))
```

### 3. NestJS Interceptor

```typescript
import { AtrionInterceptor } from './nestjs-interceptor'

// Global
app.useGlobalInterceptors(new AtrionInterceptor({ debug: true }))

// Controller-level
@UseInterceptors(AtrionInterceptor)
export class UsersController {}
```

---

## Note on Imports

These examples use **relative imports** for repo compilation:

```typescript
// In examples (for repo)
import { ... } from '../src/core/index.js'

// In your project (after npm install)
import { ... } from 'atrion'
```
