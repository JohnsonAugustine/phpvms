const leaflet = require('leaflet');
const rivets = require('rivets');

import draw_base_map from './base_map'
import {ACTUAL_ROUTE_COLOR} from './config'

/**
 * Render the live map
 * @param opts
 * @private
 */
export default (opts) => {

    opts = Object.assign({
        update_uri: '/api/acars',
        pirep_uri: '/api/pireps/{id}',
        pirep_link_uri: '/pireps/{id}',
        positions: null,
        render_elem: 'map',
        aircraft_icon: '/assets/img/acars/aircraft.png',
        units: 'nmi',
    }, opts);

    const map = draw_base_map(opts);
    const aircraftIcon = leaflet.icon({
        iconUrl: opts.aircraft_icon,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
    });

    let pannedToCenter = false;
    let layerFlights = null;
    let layerSelFlight = null;
    let layerSelFlightFeature = null;
    let layerSelFlightLayer = null;

    const r_map_view = rivets.bind($('#map-info-box'), {pirep: {}});
    const r_table_view = rivets.bind($('#live_flights'), {pireps: []});

    /**
     * When a flight is clicked on, show the path, etc for that flight
     * @param feature
     * @param layer
     */
    const onFlightClick = (feature, layer) => {

        const pirep_uri = opts.pirep_uri.replace('{id}', feature.properties.pirep_id);
        const geojson_uri = opts.pirep_uri.replace('{id}', feature.properties.pirep_id) + "/acars/geojson";

        const pirep_info = $.ajax({
            url: pirep_uri,
            dataType: 'json',
            error: console.log
        });

        const flight_route = $.ajax({
            url: geojson_uri,
            dataType: 'json',
            error: console.log
        });

        // Load up the PIREP info
        $.when(flight_route).done((routeJson) => {
            if (layerSelFlight !== null) {
                map.removeLayer(layerSelFlight);
            }

            layerSelFlight = leaflet.geodesic([], {
                weight: 5,
                opacity: 0.9,
                color: ACTUAL_ROUTE_COLOR,
                wrap: false,
            }).addTo(map);

            layerSelFlight.geoJson(routeJson.line);
            layerSelFlightFeature = feature;
            layerSelFlightLayer = layer;

            // Center on it, but only do it once, in case the map is moved
            if(!pannedToCenter) {
                map.panTo({lat: routeJson.position.lat, lng: routeJson.position.lon});
                pannedToCenter = true;
            }
        });

        //
        // When the PIREP info is done loading, show the bottom bar
        //
        $.when(pirep_info).done(pirep => {
            r_map_view.update({pirep:pirep.data});
            $('#map-info-box').show();
        });
    };

    const updateMap = () => {

        console.log('reloading flights from acars...');

        /**
         * AJAX UPDATE
         */
        const pirep_uri = opts.pirep_uri.replace('{id}', '');
        let pireps = $.ajax({
            url: pirep_uri,
            dataType: 'json',
            error: console.log
        });

        let flights = $.ajax({
            url: opts.update_uri,
            dataType: 'json',
            error: console.log
        });

        $.when(flights).done(flightGeoJson => {

            if (layerFlights !== null) {
                layerFlights.clearLayers()
            }

            layerFlights = leaflet.geoJSON(flightGeoJson, {
                onEachFeature: (feature, layer) => {
                    layer.on({
                        click: (e) => {
                            pannedToCenter = false;
                            onFlightClick(feature, layer)
                        }
                    });

                    let popup_html = '';
                    if (feature.properties && (feature.properties.popup !== '' && feature.properties.popup !== undefined)) {
                        popup_html += feature.properties.popup;
                        layer.bindPopup(popup_html);
                    }
                },
                pointToLayer: function (feature, latlon) {
                    return leaflet.marker(latlon, {
                        icon: aircraftIcon,
                        rotationAngle: feature.properties.heading
                    })
                }
            });

            layerFlights.addTo(map);

            // Reload the clicked-flight information
            if (layerSelFlight !== null) {
                onFlightClick(layerSelFlightFeature, layerSelFlightLayer)
            }
        });

        $.when(pireps).done(pireps => {
            r_table_view.update({
                pireps: pireps.data,
                has_data: (pireps.data.length > 0),
            });
        });
    };

    updateMap();
    setInterval(updateMap, 10000)
};