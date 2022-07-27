import RoomRoutes from "./routes/room";
import SystemRoutes from "./routes/system";
import Socket from "./socket";

function updateName(newName: string): void {
  if (Socket.io.opts.query) {
    Socket.io.opts.query["name"] = newName;
  }
}

function connect(): void {
  Socket.connect();
}

function disconnect(): void {
  Socket.disconnect();
}

function getId(): string {
  return Socket.id;
}

export default {
  in: {
    room: RoomRoutes.in,
    system: SystemRoutes.in,
  },
  out: {
    room: RoomRoutes.out,
    system: SystemRoutes.out,
  },
  updateName,
  connect,
  getId,
  disconnect,
};