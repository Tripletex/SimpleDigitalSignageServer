import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { createSecretSchema, updateSecretSchema } from '../validators/tenantSecretValidator.ts';
import tenantSecretRepository from '../repositories/tenantSecret.ts';

export async function getSecrets(c: Context<AppEnv>): Promise<Response> {
  const tenantId = c.req.param('tenantId');
  const secrets = await tenantSecretRepository.getSecretsByTenant(tenantId);
  return c.json({ success: true, secrets });
}

export async function createSecret(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  const tenantId = c.req.param('tenantId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = createSecretSchema.parse(body);

  try {
    const secret = await tenantSecretRepository.createSecret({
      tenantId,
      name: data.name,
      value: data.value,
      domain: data.domain,
      description: data.description,
      createdById: user.id,
    });

    return c.json({ success: true, secret }, 201);
  } catch (error) {
    // Unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return c.json({
        success: false,
        message: `A secret named "${data.name}" already exists in this organization`,
      }, 409);
    }
    throw error;
  }
}

export async function updateSecret(c: Context<AppEnv>): Promise<Response> {
  const tenantId = c.req.param('tenantId');
  const secretId = c.req.param('secretId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = updateSecretSchema.parse(body);

  const updated = await tenantSecretRepository.updateSecret(secretId, tenantId, data);
  if (!updated) {
    return c.json({ success: false, message: 'Secret not found' }, 404);
  }

  return c.json({ success: true, secret: updated });
}

export async function deleteSecret(c: Context<AppEnv>): Promise<Response> {
  const tenantId = c.req.param('tenantId');
  const secretId = c.req.param('secretId');

  const deleted = await tenantSecretRepository.deleteSecret(secretId, tenantId);
  if (!deleted) {
    return c.json({ success: false, message: 'Secret not found' }, 404);
  }

  return c.json({ success: true, message: 'Secret deleted' });
}
