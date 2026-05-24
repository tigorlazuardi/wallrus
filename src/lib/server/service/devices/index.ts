import { Base } from "../base"
import { ListDevices } from "./ListDevices"
import { GetDevice } from "./GetDevice"
import { CreateDevice } from "./CreateDevice"
import { UpdateDevice } from "./UpdateDevice"
import { DeleteDevice } from "./DeleteDevice"
import { ToggleDevice } from "./ToggleDevice"

const Service = ToggleDevice(DeleteDevice(UpdateDevice(CreateDevice(GetDevice(ListDevices(Base))))))

export class DeviceService extends Service {}
