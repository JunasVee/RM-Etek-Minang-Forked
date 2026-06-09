declare module "*.css"

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothDevice extends EventTarget {
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
  addEventListener(type: "gattserverdisconnected", listener: (this: this, ev: Event) => void): void
  removeEventListener(type: "gattserverdisconnected", listener: (this: this, ev: Event) => void): void
}

interface RequestDeviceOptions {
  filters?: { services?: string[]; name?: string; namePrefix?: string }[]
  optionalServices?: string[]
  acceptAllDevices?: boolean
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
  getDevices?(): Promise<BluetoothDevice[]>
}

interface Navigator {
  bluetooth: Bluetooth
}
