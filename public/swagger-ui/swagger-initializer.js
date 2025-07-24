window.onload = function() {
  //<editor-fold desc="Changeable Configuration Block">

  // the following lines will be replaced by docker/configurator, when it runs in a docker-container
  window.ui = SwaggerUIBundle({
    url: "http://localhost:3010/",
    dom_id: '#swagger-ui',
    presets: [ SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset ]

  });

  //</editor-fold>
};
