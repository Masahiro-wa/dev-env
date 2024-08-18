import * as fs from 'fs-extra';
import * as yaml from 'yaml';
import * as path from 'path';

class Environment {
  private envs: { [key: string]: string };

  constructor() {
    const filePath = path.join(__dirname, '../environment.yml');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    this.envs = yaml.parse(fileContent);
  }

  public get(key: string): string | undefined {
    const val = this.envs[key];
    if (val === null || val === undefined) {
      return '';
    }else {
      return val;
    }
  }
}

// グローバルで使えるインスタンスを作成
export const envs = new Environment();
