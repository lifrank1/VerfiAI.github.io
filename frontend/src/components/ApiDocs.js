import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

function ApiDocs() {
  return <SwaggerUI url="/verifAI.yml" />;
}

export default ApiDocs;
