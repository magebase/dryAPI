import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ url: '/api/tina/gql', token: 'null', queries,  });
export default client;
  