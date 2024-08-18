import * as fs from 'fs-extra';
import * as yaml from 'yaml';
import * as path from 'path';

interface Envs{
  [key: string]: string | Record<string, string>[]; 
}

class Environment {
  private envs: Envs;

  constructor() {
    const filePath = path.join(__dirname, '../environment.yml');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    this.envs = yaml.parse(fileContent);
  }

  public get(key: string, opt?:string): string {
    const val = this.envs[key];
    let defaultValue = '';
    if (opt) {
      defaultValue = opt;
    }
    if (typeof val != 'string' || val === '') {
      return defaultValue;
    } else {
      return val;
    }
  }

  public getList<T extends Record<string, string>>(key: string): T[] {
    const val = this.envs[key];
    if (Array.isArray(val)) {
      return val as T[];
    } else {
      return [];
    }
  }
}

// グローバルで使えるインスタンスを作成
export const envs = new Environment();
