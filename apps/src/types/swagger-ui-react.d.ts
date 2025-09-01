// types/swagger-ui-react.d.ts
declare module "swagger-ui-react" {
  import * as React from "react";

  export interface SwaggerUIProps {
    url?: string;
    spec?: object;
    dom_id?: string;
    presets?: any[];
    layout?: string;
  }

  export default class SwaggerUI extends React.Component<SwaggerUIProps> {}
}
