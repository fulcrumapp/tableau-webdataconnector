(function () {

  var fulcrumConnector = tableau.makeConnector();
  var rows = [];

  fulcrumConnector.init = function (initCallback) {

    if (tableau.phase == tableau.phaseEnum.interactivePhase) {
      if (tableau.connectionData) {
        var connector = JSON.parse(tableau.connectionData);
        if (connector.source == "share") {
          $("#source").val("share");
          $("#share").val(connector.share);
          $("#share-inputs").show();
          $("#share").attr("required", true);
          $("#qapi-inputs").hide();
          $("#token").attr("required", false);
          $("#query").attr("required", false);
        } else {
          $("#source").val("qapi");
          $("#token").val(connector.token);
          $("#query").val(connector.sql);
          $("#qapi-inputs").show();
          $("#token").attr("required", true);
          $("#query").attr("required", true);
          $("#share-inputs").hide();
          $("#share").attr("required", false);
        }
      }
    }

    initCallback();
  };

  fulcrumConnector.getSchema = function (schemaCallback) {

    var connector = JSON.parse(tableau.connectionData);

    // Query API
    if (connector.source == "qapi") {
      rows = [];

      var types = {
        integer: tableau.dataTypeEnum.int,
        double: tableau.dataTypeEnum.float,
        boolean: tableau.dataTypeEnum.boolean,
        geometry: tableau.dataTypeEnum.geometry,
        timestamp: tableau.dataTypeEnum.datetime,
        date: tableau.dataTypeEnum.date,
        string: tableau.dataTypeEnum.string
      };

      $.ajax({
        type: "POST",
        url: "https://api.fulcrumapp.com/api/v2/query",
        contentType: "application/json",
        data: JSON.stringify({
          "q": connector.sql,
          "format": "json"
        }),
        headers: {
          "X-ApiToken": connector.token
        },
        success: function (data) {
          var columns = data.fields.map(function (field) {
            return {
              id: field.name,
              dataType: types[field.type] || tableau.dataTypeEnum.string
            };
          });

          var tableSchema = {
            id: "fulcrumFeed",
            alias: "Fulcrum data",
            columns: columns
          };

          data.rows.forEach(function (row) {
            for (var key in row) {
              if (row.hasOwnProperty(key) && Array.isArray(row[key])) {
                row[key] = row[key].join(",");
              }
            }
            rows.push(row);
          });

          schemaCallback([tableSchema]);
        }
      });
    } else {

      // Data Shares
      var columns = [];
      rows = [];

      $.ajax({
        type: "GET",
        url: "https://web.fulcrumapp.com/shares/" + connector.share + ".geojson",
        contentType: "application/json",
        success: function (data) {

          var properties = data.features[0].properties;
          for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
              var type;
              if (typeof properties[key] == "number") {
                if (properties[key] % 1 === 0) {
                  type = tableau.dataTypeEnum.int;
                } else {
                  type = tableau.dataTypeEnum.float;
                }
              } else if (key == "created_at" || key == "updated_at" || key == "system_created_at" || key == "system_updated_at") {
                type = tableau.dataTypeEnum.datetime;
              } else if (key == "marker-color") {
                key = "marker_color";
                type = tableau.dataTypeEnum.string;
              } else {
                type = tableau.dataTypeEnum.string;
              }

              columns.push({
                id: key,
                dataType: type
              });
            }
          }

          var tableSchema = {
            id: "fulcrumFeed",
            alias: "Fulcrum data",
            columns: columns
          };

          data.features.forEach(function (feature) {
            feature.properties["created_at"] = feature.properties["created_at"].replace(" UTC", "");
            feature.properties["updated_at"] = feature.properties["updated_at"].replace(" UTC", "");
            feature.properties["system_created_at"] = feature.properties["system_created_at"].replace(" UTC", "");
            feature.properties["system_updated_at"] = feature.properties["system_updated_at"].replace(" UTC", "");
            if (feature.properties["marker-color"]) {
              feature.properties["marker_color"] = feature.properties["marker-color"];
              delete feature.properties["marker-color"];
            }
            rows.push(feature.properties);
          });

          schemaCallback([tableSchema]);
        }
      });
    }
  };

  // Set the data
  fulcrumConnector.getData = function (table, doneCallback) {
    table.appendRows(rows);
    doneCallback();
  };

  tableau.registerConnector(fulcrumConnector);


  $(document).ready(function () {

    $("#source").on("change", function () {
      if ($("#source").val() == "share") {
        $("#share-inputs").show();
        $("#share").attr("required", true);
        $("#qapi-inputs").hide();
        $("#token").attr("required", false);
        $("#query").attr("required", false);
      } else {
        $("#qapi-inputs").show();
        $("#token").attr("required", true);
        $("#query").attr("required", true);
        $("#share-inputs").hide();
        $("#share").attr("required", false);
      }
    });

    $("#input-form").on("submit", function (e) {
      e.preventDefault();
      if (this.checkValidity()) {
        var data = {
          source: $("#source").val(),
          share: $("#share").val(),
          token: $("#token").val(),
          sql: $("#query").val()
        };

        tableau.connectionData = JSON.stringify(data);
        tableau.connectionName = "Fulcrum"; // This will be the data source name in Tableau
        tableau.submit(); // This sends the connector object to Tableau 
      } else {
        this.classList.add("was-validated");
      }
    });

  });
})();