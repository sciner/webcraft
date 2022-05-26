export class attribute {

  static getAttributeValue(prop) {
    let x = prop.value
    for (const mod of prop.modifiers) {
      if (mod.operation !== 0) continue
      x += mod.amount
    }
    let y = x
    for (const mod of prop.modifiers) {
      if (mod.operation !== 1) continue
      y += x * mod.amount
    }
    for (const mod of prop.modifiers) {
      if (mod.operation !== 2) continue
      y += y * mod.amount
    }
    return y
  }

  static createAttributeValue(base) {
    const attributes = {
      value: base,
      modifiers: []
    }
    return attributes
  }

  static addAttributeModifier(attributes, modifier) {
    const end = attributes.modifiers.length
    // add modifer at the end
    attributes.modifiers[end] = modifier
    return attributes
  }

  static checkAttributeModifier(attributes, uuid) {
    for (const modifier of attributes.modifiers) {
      if (modifier.uuid === uuid) return true
    }
    return false
  }

  static deleteAttributeModifier(attributes, uuid) {
    for (const modifier of attributes.modifiers) {
      if (modifier.uuid === uuid) delete attributes.modifiers[modifier]
    }
    return attributes
  }

}