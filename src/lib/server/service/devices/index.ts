import { ListDevices } from "./ListDevices";
import { Base } from "../base";

const Service = ListDevices(Base)

export class DeviceService extends Service { }
