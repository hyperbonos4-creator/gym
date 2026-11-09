# Migraciones TypeORM (access/backend)

## Generar y aplicar (entorno limpio / nuevo)

```bash
cd access/backend
# DB_SYNCHRONIZE=false  (obligatorio al generar)
npm run migration:generate -- src/database/migrations/Nombre
npm run migration:run
npm run seed
```

Scripts: `migration:generate`, `migration:run`, `migration:revert`, `migration:create`.
DataSource CLI: `src/database/data-source.ts` (tabla `typeorm_migrations`).
En runtime Nest: `DB_SYNCHRONIZE=false` y `migrationsRun: false` — las migraciones se aplican a mano con el CLI.

Migración inicial actual: `1794195155529-InitialSchema.ts`.

## Baseline en una DB de producción que ya tiene tablas (synchronize)

La DB real ya tiene el esquema creado con `synchronize: true`. **No ejecutes** `migration:run` a ciegas: el `up` de `InitialSchema` haría `CREATE TABLE` y fallaría (o peor, dejaría estado a medias).

Pasos seguros (solo lectura / metadata; no toca filas de negocio):

1. Pon `DB_SYNCHRONIZE=false` en el `.env` de producción y reinicia el backend.
2. Crea la tabla de control si no existe (TypeORM la crea sola al marcar; o a mano):

```sql
CREATE TABLE IF NOT EXISTS typeorm_migrations (
  id SERIAL PRIMARY KEY,
  timestamp bigint NOT NULL,
  name character varying NOT NULL
);
```

3. **Marca la migración inicial como ya aplicada** (baseline), sin ejecutar el SQL de `up`:

```bash
cd access/backend
# Con las credenciales de producción cargadas en el entorno del CLI:
npx typeorm-ts-node-commonjs migration:show -d src/database/data-source.ts
```

Inserta a mano el registro que TypeORM esperaría:

```sql
INSERT INTO typeorm_migrations (timestamp, name)
VALUES (1794195155529, 'InitialSchema1794195155529')
ON CONFLICT DO NOTHING;
```

(Alternativa equivalente con el CLI si tu versión soporta fake: no hay `migration:fake` estable en TypeORM 0.3; el INSERT es el método recomendado.)

4. Verifica:

```bash
npm run typeorm -- migration:show
# Debe listar InitialSchema como executed.
```

5. A partir de ahí, cualquier cambio de esquema se hace con `migration:generate` / `migration:run` en un entorno de staging primero. Nunca vuelvas a `DB_SYNCHRONIZE=true` en producción.

## Rollback

`npm run migration:revert` revierte la última entrada de `typeorm_migrations`. El `down` de InitialSchema hace DROP de todas las tablas — **no lo uses en producción con datos**.
