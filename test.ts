import { injectable, Container, inject } from './';

interface Weapon {
  damage: number;
}

class Katana implements Weapon {
  damage: number;
  constructor(damage: number) {
    this.damage = damage;
  }
}

const weaponIdentifier = Symbol.for('weapon-id');

class Name {
  private fullName: string;
  constructor(firstN: string, lastN: string) {
    this.fullName = `${firstN} ${lastN}`;
  }
  get name() {
    return this.fullName;
  }
}

@injectable()
class Ninja {
  private name: Name;
  private weapon: Weapon;
  constructor(name: Name, @inject(weaponIdentifier) weapon: Weapon) {
    this.name = name;
    this.weapon = weapon;
  }
}

const container = new Container();
container.bind(weaponIdentifier).toConstantValue(new Katana(50));
container.bind(Name).toConstantValue(new Name('Dmytro', 'Lesyk'));

const ninja = container.get(Ninja);
console.log(ninja);
