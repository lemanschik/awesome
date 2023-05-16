export class Parent {
  constructor() {
    this.children = [];
  }

  addChild(child) {
    const ordinal = this.children.length;
    console.log(`Adding child #${ordinal}`);
    child.setOrdinal(ordinal);

    // Go over the children and make siblings aware of each other.
    for (const c of this.children) {
      c.setSibling(child);
      child.setSibling(c);
    }
    this.children.push(child);
    return ordinal;
  }
}

export class Child {
  constructor() {
    // Obtain handle to self that is used in RPC.
    this.handle_ = rpc.handle(this);
  }

  setOrdinal(ordinal) { this.ordinal_ = ordinal; }
  ordinal() { return this.ordinal_; }

  async setSibling(sibling) {
    // Say hello to another sibling when it is reported.
    const o = await sibling.ordinal();
    console.log(`I am #${this.ordinal_} and I have a sibling #${o}`);
    await sibling.hiSibling(this.handle_);
  }

  async hiSibling(sibling) {
    const o = await sibling.ordinal();
    console.log(`I am #${this.ordinal_} and my sibling #${o} is saying hello`);
  }

  dispose() {
    rpc.dispose(this.handle_);
  }
}
