export const storage = {
  async readJson<T>(path: string): Promise<T | null> {
    try {
      const text = await Deno.readTextFile(path);
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  },

  async writeJson(path: string, data: unknown): Promise<void> {
    const dir = path.substring(0, path.lastIndexOf('/'));
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2) + '\n');
  },

  async remove(path: string): Promise<void> {
    try {
      await Deno.remove(path);
    } catch { /* ignore if file doesn't exist */ }
  },

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  },
};
