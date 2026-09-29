/* =========================================================
   AJMAN ECO-PULSE
   Interactive Data Visualizations
   ========================================================= */


/* =========================================================
   DATA SOURCES
   ========================================================= */

const HISTORY_URL = "data/processed/historical-waste.json";
const AMBIGUITIES_URL = "data/processed/historical-ambiguities.json";
const DISTRICT_URL = "data/processed/district-composition.json";
const MAP_URL = "data/processed/district-map-clean.geojson";


/* =========================================================
   LOAD DATA
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    try {

        const [
            history,
            ambiguities,
            districts,
            mapData
        ] = await Promise.all([
            d3.json(HISTORY_URL),
            d3.json(AMBIGUITIES_URL),
            d3.json(DISTRICT_URL),
            d3.json(MAP_URL)
        ]);

        console.log("Historical data:", history);
        console.log("Historical ambiguities:", ambiguities);
        console.log("District data:", districts);
        console.log("Map data:", mapData);

        drawTimeline(history, ambiguities);
drawCityComposition(districts);
drawDistrictExplorer(districts, mapData);
drawDistrictComparison(districts);

/* Start page motion after content exists */
initializeScrollReveals();

    } catch (error) {

        console.error(
            "Eco-Pulse data loading error:",
            error
        );

    }

});


/* =========================================================
   HISTORICAL TIMELINE
   ========================================================= */

function drawTimeline(data, ambiguities) {

    const container =
        document.getElementById("timeline-chart");

    container.innerHTML = "";

    const width =
        container.clientWidth;

    const height = 470;

    const margin = {
        top: 40,
        right: 30,
        bottom: 55,
        left: 75
    };

    const chartWidth =
        width -
        margin.left -
        margin.right;

    const chartHeight =
        height -
        margin.top -
        margin.bottom;

    const parseDate =
        d3.timeParse("%Y-%m");


    /* -----------------------------------------------------
       VALIDATED OBSERVATIONS
       ----------------------------------------------------- */

    const cleanData = data
        .filter(
            d =>
                d.quantity !== null &&
                d.quantity !== undefined
        )
        .map(d => ({
            ...d,

            dateObject:
                parseDate(d.date),

            quantity:
                Number(d.quantity)
        }))
        .filter(
            d =>
                d.dateObject &&
                Number.isFinite(d.quantity)
        )
        .sort(
            (a, b) =>
                a.dateObject -
                b.dateObject
        );


    /* -----------------------------------------------------
       AMBIGUOUS MONTHS
       ----------------------------------------------------- */

    const ambiguityDates =
        new Set(
            (ambiguities || [])
                .map(d => d.date)
                .filter(Boolean)
        );


    /* -----------------------------------------------------
       SVG
       ----------------------------------------------------- */

    const svg = d3
        .select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        );


    const chart = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    /* -----------------------------------------------------
       SCALES
       ----------------------------------------------------- */

    const x = d3
        .scaleTime()
        .domain(
            d3.extent(
                cleanData,
                d => d.dateObject
            )
        )
        .range([
            0,
            chartWidth
        ]);


    const y = d3
        .scaleLinear()
        .domain([
            0,
            d3.max(
                cleanData,
                d => d.quantity
            ) * 1.08
        ])
        .nice()
        .range([
            chartHeight,
            0
        ]);


    /* -----------------------------------------------------
       GRID
       ----------------------------------------------------- */

    chart
        .append("g")
        .attr("class", "grid")
        .call(
            d3
                .axisLeft(y)
                .ticks(5)
                .tickSize(-chartWidth)
                .tickFormat("")
        )
        .call(
            g =>
                g.select(".domain")
                    .remove()
        )
        .call(
            g =>
                g.selectAll("line")
                    .attr(
                        "stroke",
                        "rgba(255,255,255,0.06)"
                    )
        );


    /* -----------------------------------------------------
       X AXIS
       ----------------------------------------------------- */

    const xAxis = chart
        .append("g")
        .attr(
            "transform",
            `translate(0,${chartHeight})`
        )
        .call(
    d3
        .axisBottom(x)
        .ticks(
            width < 600
                ? d3.timeYear.every(2)
                : d3.timeYear.every(1)
        )
        .tickFormat(d3.timeFormat("%Y"))
);


    xAxis
        .select(".domain")
        .attr(
            "stroke",
            "rgba(255,255,255,0.12)"
        );


    xAxis
        .selectAll("text")
        .attr(
            "fill",
            "#8fa79e"
        )
        .attr(
            "font-size",
            "10px"
        );


    xAxis
        .selectAll("line")
        .attr(
            "stroke",
            "rgba(255,255,255,0.1)"
        );


    /* -----------------------------------------------------
       Y AXIS
       ----------------------------------------------------- */

    const yAxis = chart
        .append("g")
        .call(
            d3
                .axisLeft(y)
                .ticks(5)
                .tickFormat(
                    d3.format("~s")
                )
        );


    yAxis
        .select(".domain")
        .remove();


    yAxis
        .selectAll("text")
        .attr(
            "fill",
            "#8fa79e"
        )
        .attr(
            "font-size",
            "10px"
        );


    yAxis
        .selectAll("line")
        .remove();


    /* -----------------------------------------------------
       AREA GRADIENT
       ----------------------------------------------------- */

    const defs =
        svg.append("defs");


    const gradient = defs
        .append("linearGradient")
        .attr(
            "id",
            "timeline-gradient"
        )
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");


    gradient
        .append("stop")
        .attr("offset", "0%")
        .attr(
            "stop-color",
            "#62f6ad"
        )
        .attr(
            "stop-opacity",
            0.28
        );


    gradient
        .append("stop")
        .attr("offset", "100%")
        .attr(
            "stop-color",
            "#62f6ad"
        )
        .attr(
            "stop-opacity",
            0
        );


    /* -----------------------------------------------------
       SPLIT DATA INTO CONTINUOUS MONTHLY SEGMENTS

       Missing/ambiguous months become visible gaps.
       ----------------------------------------------------- */

    const segments = [];

    let currentSegment = [];


    cleanData.forEach(d => {

        if (
            currentSegment.length === 0
        ) {

            currentSegment.push(d);

            return;

        }


        const previous =
            currentSegment[
                currentSegment.length - 1
            ];


        const expectedNext =
            d3.timeMonth.offset(
                previous.dateObject,
                1
            );


        const isConsecutive =
            +expectedNext ===
            +d.dateObject;


        if (isConsecutive) {

            currentSegment.push(d);

        } else {

            segments.push(
                currentSegment
            );

            currentSegment = [d];

        }

    });


    if (
        currentSegment.length > 0
    ) {

        segments.push(
            currentSegment
        );

    }


    /* -----------------------------------------------------
       AREA
       ----------------------------------------------------- */

    const area = d3
        .area()
        .x(
            d =>
                x(d.dateObject)
        )
        .y0(
            chartHeight
        )
        .y1(
            d =>
                y(d.quantity)
        )
        .curve(
            d3.curveMonotoneX
        );


    segments.forEach(segment => {

        if (
            segment.length < 2
        ) {
            return;
        }


        chart
            .append("path")
            .datum(segment)
            .attr(
                "fill",
                "url(#timeline-gradient)"
            )
            .attr(
                "d",
                area
            );

    });


    /* -----------------------------------------------------
       LINE
       ----------------------------------------------------- */

    const line = d3
        .line()
        .x(
            d =>
                x(d.dateObject)
        )
        .y(
            d =>
                y(d.quantity)
        )
        .curve(
            d3.curveMonotoneX
        );


    segments.forEach(segment => {

        if (
            segment.length < 2
        ) {
            return;
        }


        const linePath = chart
            .append("path")
            .datum(segment)
            .attr(
                "fill",
                "none"
            )
            .attr(
                "stroke",
                "#62f6ad"
            )
            .attr(
                "stroke-width",
                2
            )
            .attr(
                "d",
                line
            );


        const totalLength =
            linePath
                .node()
                .getTotalLength();


        linePath
            .attr(
                "stroke-dasharray",
                `${totalLength} ${totalLength}`
            )
            .attr(
                "stroke-dashoffset",
                totalLength
            )
            .transition()
            .duration(1200)
            .ease(
                d3.easeCubicOut
            )
            .attr(
                "stroke-dashoffset",
                0
            );

    });


    /* -----------------------------------------------------
       AMBIGUOUS MONTH MARKERS
       ----------------------------------------------------- */

    const ambiguousMonths =
        [...ambiguityDates]
            .map(date => ({
                date,
                dateObject:
                    parseDate(date)
            }))
            .filter(
                d => d.dateObject
            );


    const ambiguityGroups =
        chart
            .selectAll(
                ".ambiguity-marker"
            )
            .data(
                ambiguousMonths
            )
            .join("g")
            .attr(
                "class",
                "ambiguity-marker"
            )
            .attr(
                "transform",
                d =>
                    `translate(${x(
                        d.dateObject
                    )},0)`
            );


    ambiguityGroups
        .append("line")
        .attr("y1", 0)
        .attr(
            "y2",
            chartHeight
        )
        .attr(
            "stroke",
            "rgba(255,190,92,0.18)"
        )
        .attr(
            "stroke-dasharray",
            "3 6"
        );


    ambiguityGroups
        .append("circle")
        .attr(
            "cy",
            chartHeight
        )
        .attr("r", 3.5)
        .attr(
            "fill",
            "#ffbe5c"
        );


    /* -----------------------------------------------------
       TOOLTIP
       ----------------------------------------------------- */

    const tooltip = d3
        .select("body")
        .append("div")
        .attr(
            "class",
            "eco-tooltip"
        )
        .style(
            "opacity",
            0
        );


    const focusLine = chart
        .append("line")
        .attr(
            "stroke",
            "rgba(98,246,173,0.35)"
        )
        .attr(
            "stroke-width",
            1
        )
        .attr("y1", 0)
        .attr(
            "y2",
            chartHeight
        )
        .style(
            "opacity",
            0
        );


    const focusDot = chart
        .append("circle")
        .attr("r", 5)
        .attr(
            "fill",
            "#62f6ad"
        )
        .attr(
            "stroke",
            "#06100d"
        )
        .attr(
            "stroke-width",
            3
        )
        .style(
            "opacity",
            0
        );


    const bisect =
        d3.bisector(
            d =>
                d.dateObject
        ).center;


    /* -----------------------------------------------------
       INTERACTION LAYER
       ----------------------------------------------------- */

    chart
        .append("rect")
        .attr(
            "width",
            chartWidth
        )
        .attr(
            "height",
            chartHeight
        )
        .attr(
            "fill",
            "transparent"
        )

        .on(
            "mousemove",
            function(event) {

                const [mouseX] =
                    d3.pointer(
                        event,
                        this
                    );


                const hoveredDate =
                    x.invert(mouseX);


                const hoveredMonth =
                    d3.timeMonth.round(
                        hoveredDate
                    );


                const monthKey =
                    d3.timeFormat(
                        "%Y-%m"
                    )(
                        hoveredMonth
                    );


                /* -----------------------------------------
                   AMBIGUOUS MONTH
                   ----------------------------------------- */

                if (
                    ambiguityDates.has(
                        monthKey
                    )
                ) {

                    focusLine
                        .style(
                            "opacity",
                            0
                        );


                    focusDot
                        .style(
                            "opacity",
                            0
                        );


                    tooltip
                        .style(
                            "opacity",
                            1
                        )
                        .html(`
                            <span>
                                ${d3.timeFormat(
                                    "%B %Y"
                                )(
                                    hoveredMonth
                                )}
                            </span>

                            <strong
                                style="color:#ffbe5c"
                            >
                                Conflicting source values
                            </strong>
                        `)
                        .style(
                            "left",
                            `${event.pageX + 16}px`
                        )
                        .style(
                            "top",
                            `${event.pageY - 30}px`
                        );


                    return;

                }


                /* -----------------------------------------
                   VALID MONTH
                   ----------------------------------------- */

                const index =
                    bisect(
                        cleanData,
                        hoveredDate
                    );


                const d =
                    cleanData[index];


                if (!d) {
                    return;
                }


                focusLine
                    .attr(
                        "x1",
                        x(d.dateObject)
                    )
                    .attr(
                        "x2",
                        x(d.dateObject)
                    )
                    .style(
                        "opacity",
                        1
                    );


                focusDot
                    .attr(
                        "cx",
                        x(d.dateObject)
                    )
                    .attr(
                        "cy",
                        y(d.quantity)
                    )
                    .style(
                        "opacity",
                        1
                    );


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <span>
                            ${d.month} ${d.year}
                        </span>

                        <strong>
                            ${d3.format(
                                ",.1f"
                            )(
                                d.quantity
                            )}
                        </strong>
                    `)
                    .style(
                        "left",
                        `${event.pageX + 16}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 30}px`
                    );

            }
        )

        .on(
            "mouseleave",
            function() {

                focusLine
                    .style(
                        "opacity",
                        0
                    );


                focusDot
                    .style(
                        "opacity",
                        0
                    );


                tooltip
                    .style(
                        "opacity",
                        0
                    );

            }
        );

}


/* =========================================================
   CITYWIDE COMPOSITION STORY
   ========================================================= */

function drawCityComposition(data) {

    const grouped = d3
        .rollups(
            data,
            values =>
                d3.mean(
                    values,
                    d => +d.percentage
                ),
            d => d.waste_type
        )
        .map(
            ([category, percentage]) => ({
                category,
                percentage
            })
        )
        .sort(
            (a, b) =>
                b.percentage -
                a.percentage
        );


    /* -----------------------------------------------------
       DONUT VISUALIZATION
       ----------------------------------------------------- */

    const svg =
        d3.select(
            "#composition-ring"
        );


    svg
        .selectAll("*")
        .remove();


    const width = 500;
    const height = 500;
    const radius = 190;


    const chart = svg
        .append("g")
        .attr(
            "transform",
            `translate(${width / 2},${height / 2})`
        );


    const pie = d3
        .pie()
        .sort(null)
        .value(
            d => d.percentage
        );


    const arc = d3
        .arc()
        .innerRadius(135)
        .outerRadius(radius)
        .cornerRadius(3);


    const hoverArc = d3
        .arc()
        .innerRadius(132)
        .outerRadius(
            radius + 10
        )
        .cornerRadius(3);


    const colors = [
        "#62f6ad",
        "#4bd4a0",
        "#3ab896",
        "#319c89",
        "#398879",
        "#47786d",
        "#526d65",
        "#5d655f",
        "#53605b",
        "#495752",
        "#414e4a",
        "#394640",
        "#323e39",
        "#2b3732",
        "#25312c"
    ];


    const color = d3
        .scaleOrdinal()
        .domain(
            grouped.map(
                d => d.category
            )
        )
        .range(colors);


    const tooltip = d3
        .select("body")
        .append("div")
        .attr(
            "class",
            "eco-tooltip"
        )
        .style(
            "opacity",
            0
        );


    const segments = chart
        .selectAll("path")
        .data(
            pie(grouped)
        )
        .join("path")
        .attr(
            "fill",
            d =>
                color(
                    d.data.category
                )
        )
        .attr(
            "stroke",
            "#06100d"
        )
        .attr(
            "stroke-width",
            3
        )
        .attr(
            "d",
            arc
        )
        .style(
            "cursor",
            "pointer"
        );


    /* -----------------------------------------------------
       DONUT ANIMATION
       ----------------------------------------------------- */

    segments
        .transition()
        .duration(900)
        .attrTween(
            "d",
            function(d) {

                const interpolate =
                    d3.interpolate(
                        {
                            startAngle: 0,
                            endAngle: 0
                        },
                        d
                    );


                return t =>
                    arc(
                        interpolate(t)
                    );

            }
        );


    /* -----------------------------------------------------
       DONUT INTERACTION
       ----------------------------------------------------- */

    segments
        .on(
            "mouseenter",
            function(event, d) {

                d3
                    .select(this)
                    .transition()
                    .duration(180)
                    .attr(
                        "d",
                        hoverArc
                    );


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <span>
                            ${d.data.category}
                        </span>

                        <strong>
                            ${formatPercentage(
                                d.data.percentage
                            )}
                        </strong>
                    `);

            }
        )

        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 16}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 30}px`
                    );

            }
        )

        .on(
            "mouseleave",
            function() {

                d3
                    .select(this)
                    .transition()
                    .duration(180)
                    .attr(
                        "d",
                        arc
                    );


                tooltip
                    .style(
                        "opacity",
                        0
                    );

            }
        );


    /* -----------------------------------------------------
       CATEGORY RANKING
       ----------------------------------------------------- */

    const list =
        d3.select(
            "#city-composition-list"
        );


    list
        .selectAll("*")
        .remove();


    const rows = list
        .selectAll(
            ".city-category"
        )
        .data(grouped)
        .join("div")
        .attr(
            "class",
            "city-category"
        );


    const rowTop = rows
        .append("div")
        .attr(
            "class",
            "city-category-top"
        );


    rowTop
        .append("div")
        .attr(
            "class",
            "category-name"
        )
        .html(
            d => `
                <span
                    class="category-dot"
                    style="background:${color(
                        d.category
                    )}"
                ></span>
                ${d.category}
            `
        );


    rowTop
        .append("strong")
        .text(
            d =>
                formatPercentage(
                    d.percentage
                )
        );


    const tracks = rows
        .append("div")
        .attr(
            "class",
            "city-category-track"
        );


    tracks
        .append("div")
        .attr(
            "class",
            "city-category-fill"
        )
        .style(
            "background",
            d =>
                color(
                    d.category
                )
        )
        .style(
            "width",
            "0%"
        )
        .transition()
        .duration(900)
        .delay(
            (d, i) =>
                i * 35
        )
        .style(
            "width",
            d =>
                `${d.percentage}%`
        );

}


/* =========================================================
   DISTRICT EXPLORER
   ========================================================= */

function drawDistrictExplorer(
    compositionData,
    geoData
) {

    const container =
        document.getElementById(
            "district-map"
        );


    container.innerHTML = "";


    /* -----------------------------------------------------
       GROUP COMPOSITION BY DISTRICT
       ----------------------------------------------------- */

    const districtData =
        d3.group(
            compositionData,
            d =>
                normalizeDistrictName(
                    d.district
                )
        );


    console.log(
        "Composition districts:",
        [...districtData.keys()]
    );


    console.log(
        "Map properties:",
        geoData
            .features[0]
            ?.properties
    );


    /* -----------------------------------------------------
       MAP SIZE
       ----------------------------------------------------- */

    const width =
        container.clientWidth;

    const height = 540;


    const svg = d3
        .select(container)
        .append("svg")
        .attr(
            "width",
            width
        )
        .attr(
            "height",
            height
        )
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        )
        .attr(
            "class",
            "ajman-map"
        );


    /* -----------------------------------------------------
       MAP PROJECTION
       ----------------------------------------------------- */

    const projection = d3
        .geoMercator()
        .fitExtent(
            [
                [35, 35],
                [
                    width - 35,
                    height - 35
                ]
            ],
            geoData
        );


    const path = d3
        .geoPath()
        .projection(
            projection
        );


    /* -----------------------------------------------------
       MAP TOOLTIP
       ----------------------------------------------------- */

    const tooltip = d3
        .select("body")
        .append("div")
        .attr(
            "class",
            "map-tooltip"
        )
        .style(
            "opacity",
            0
        );


    /* -----------------------------------------------------
       DRAW DISTRICTS
       ----------------------------------------------------- */

    const districtPaths = svg
        .append("g")
        .attr(
            "class",
            "district-shapes"
        )
        .selectAll("path")
        .data(
            geoData.features
        )
        .join("path")
        .attr(
            "d",
            path
        )
        .attr(
            "class",
            "district-shape"
        )
        .attr(
            "data-district",
            d =>
                getMapDistrictName(
                    d
                )
        )

        .on(
            "mouseenter",
            function(event, d) {

                const districtName =
                    getMapDistrictName(
                        d
                    );


                d3
                    .select(this)
                    .classed(
                        "hovered",
                        true
                    );


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <span>
                            DISTRICT
                        </span>

                        <strong>
                            ${districtName}
                        </strong>

                        <small>
                            Click to explore
                        </small>
                    `);

            }
        )

        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 16}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 25}px`
                    );

            }
        )

        .on(
            "mouseleave",
            function() {

                d3
                    .select(this)
                    .classed(
                        "hovered",
                        false
                    );


                tooltip
                    .style(
                        "opacity",
                        0
                    );

            }
        )

        .on(
            "click",
            function(event, d) {

                const districtName =
                    getMapDistrictName(
                        d
                    );


                districtPaths
                    .classed(
                        "selected",
                        false
                    );


                d3
                    .select(this)
                    .classed(
                        "selected",
                        true
                    );


                updateDistrictProfile(
                    districtName,
                    districtData
                );

            }
        );


    /* -----------------------------------------------------
       SELECT FIRST VALID DISTRICT
       ----------------------------------------------------- */

    const firstValidFeature =
        geoData.features.find(
            feature => {

                const name =
                    normalizeDistrictName(
                        getMapDistrictName(
                            feature
                        )
                    );


                return districtData
                    .has(name);

            }
        );


    if (firstValidFeature) {

        const firstName =
            getMapDistrictName(
                firstValidFeature
            );


        districtPaths
            .filter(
                d =>
                    getMapDistrictName(
                        d
                    ) === firstName
            )
            .classed(
                "selected",
                true
            );


        updateDistrictProfile(
            firstName,
            districtData
        );

    }

}


/* =========================================================
   DISTRICT PROFILE
   ========================================================= */

function updateDistrictProfile(
    districtName,
    groupedData
) {

    const normalized =
        normalizeDistrictName(
            districtName
        );


    const rows =
        groupedData.get(
            normalized
        );


    const title =
        document.getElementById(
            "selected-district"
        );


    const description =
        document.getElementById(
            "district-description"
        );


    const chartContainer =
        document.getElementById(
            "composition-chart"
        );


    title.textContent =
        districtName;


    chartContainer.innerHTML =
        "";


    if (
        !rows ||
        rows.length === 0
    ) {

        description.textContent =
            "Composition data is unavailable for this district.";

        return;

    }


    /* -----------------------------------------------------
       SORT CATEGORIES
       ----------------------------------------------------- */

    const sorted =
        [...rows]
            .sort(
                (a, b) =>
                    b.percentage -
                    a.percentage
            );


    const dominant =
        sorted[0];


    /* -----------------------------------------------------
       DESCRIPTION
       ----------------------------------------------------- */

    description.innerHTML = `
        <strong>
            ${dominant.waste_type}
        </strong>
        is the largest recorded waste category,
        representing
        <strong>
            ${formatPercentage(
                dominant.percentage
            )}
        </strong>
        of this district's 2023 composition.
    `;


    /* -----------------------------------------------------
       DOMINANT CATEGORY SUMMARY
       ----------------------------------------------------- */

    const summary = d3
        .select(
            chartContainer
        )
        .append("div")
        .attr(
            "class",
            "composition-summary"
        );


    summary
        .append("span")
        .text(
            "DOMINANT CATEGORY"
        );


    summary
        .append("strong")
        .text(
            dominant.waste_type
        );


    summary
        .append("b")
        .text(
            formatPercentage(
                dominant.percentage
            )
        );


    /* -----------------------------------------------------
       CATEGORY LIST
       ----------------------------------------------------- */

    const list = d3
        .select(
            chartContainer
        )
        .append("div")
        .attr(
            "class",
            "composition-list"
        );


    const items = list
        .selectAll(
            ".composition-item"
        )
        .data(sorted)
        .join("div")
        .attr(
            "class",
            "composition-item"
        );


    const itemHeader = items
        .append("div")
        .attr(
            "class",
            "composition-item-header"
        );


    itemHeader
        .append("span")
        .text(
            d =>
                d.waste_type
        );


    itemHeader
        .append("strong")
        .text(
            d =>
                formatPercentage(
                    d.percentage
                )
        );


    /* -----------------------------------------------------
       BARS
       ----------------------------------------------------- */

    const bars = items
        .append("div")
        .attr(
            "class",
            "composition-bar"
        );


    bars
        .append("div")
        .attr(
            "class",
            "composition-bar-fill"
        )
        .style(
            "width",
            "0%"
        )
        .transition()
        .duration(700)
        .delay(
            (d, i) =>
                i * 35
        )
        .style(
            "width",
            d =>
                `${Math.min(
                    d.percentage,
                    100
                )}%`
        );

}


/* =========================================================
   DISTRICT COMPARISON
   ========================================================= */

function drawDistrictComparison(data) {

    const grouped =
        d3.group(
            data,
            d => d.district
        );


    const districtNames =
        [...grouped.keys()]
            .sort(
                (a, b) =>
                    a.localeCompare(b)
            );


    const selectA =
        d3.select(
            "#district-a"
        );


    const selectB =
        d3.select(
            "#district-b"
        );


    selectA
        .selectAll("option")
        .data(
            districtNames
        )
        .join("option")
        .attr(
            "value",
            d => d
        )
        .text(
            d => d
        );


    selectB
        .selectAll("option")
        .data(
            districtNames
        )
        .join("option")
        .attr(
            "value",
            d => d
        )
        .text(
            d => d
        );


    /* -----------------------------------------------------
       DEFAULT DISTRICTS
       ----------------------------------------------------- */

    selectA.property(
        "value",
        districtNames[0]
    );


    selectB.property(
        "value",
        districtNames[
            Math.min(
                20,
                districtNames.length - 1
            )
        ]
    );


    function update() {

        updateDistrictComparison(
            selectA.property(
                "value"
            ),

            selectB.property(
                "value"
            ),

            grouped
        );

    }


    selectA.on(
        "change",
        update
    );


    selectB.on(
        "change",
        update
    );


    update();

}


/* =========================================================
   UPDATE DISTRICT COMPARISON
   ========================================================= */

function updateDistrictComparison(
    districtA,
    districtB,
    grouped
) {

    const rowsA =
        grouped.get(
            districtA
        ) || [];


    const rowsB =
        grouped.get(
            districtB
        ) || [];


    const valuesA =
        new Map(
            rowsA.map(
                d => [
                    d.waste_type,
                    +d.percentage
                ]
            )
        );


    const valuesB =
        new Map(
            rowsB.map(
                d => [
                    d.waste_type,
                    +d.percentage
                ]
            )
        );


    const categories =
        Array.from(
            new Set([
                ...valuesA.keys(),
                ...valuesB.keys()
            ])
        );


    const comparison =
        categories
            .map(
                category => {

                    const a =
                        valuesA.get(
                            category
                        ) || 0;


                    const b =
                        valuesB.get(
                            category
                        ) || 0;


                    return {

                        category,

                        a,

                        b,

                        difference:
                            Math.abs(
                                a - b
                            )

                    };

                }
            )
            .sort(
                (x, y) =>
                    Math.max(
                        y.a,
                        y.b
                    ) -
                    Math.max(
                        x.a,
                        x.b
                    )
            );


    const biggestDifference =
        [...comparison]
            .sort(
                (x, y) =>
                    y.difference -
                    x.difference
            )[0];


    if (!biggestDifference) {
        return;
    }


    /* -----------------------------------------------------
       LABELS
       ----------------------------------------------------- */

    document.getElementById(
        "legend-a-name"
    ).textContent =
        districtA;


    document.getElementById(
        "legend-b-name"
    ).textContent =
        districtB;


    document.getElementById(
        "difference-category"
    ).textContent =
        biggestDifference.category;


    document.getElementById(
        "difference-value"
    ).textContent =
        biggestDifference
            .difference
            .toFixed(1);


    /* -----------------------------------------------------
       AUTOMATIC INSIGHT
       ----------------------------------------------------- */

    const higherDistrict =
        biggestDifference.a >
        biggestDifference.b

            ? districtA

            : districtB;


    const lowerDistrict =
        biggestDifference.a >
        biggestDifference.b

            ? districtB

            : districtA;


    const higherValue =
        Math.max(
            biggestDifference.a,
            biggestDifference.b
        );


    const lowerValue =
        Math.min(
            biggestDifference.a,
            biggestDifference.b
        );


    document.getElementById(
        "comparison-insight"
    ).innerHTML = `
        The largest difference between
        <strong>${districtA}</strong>
        and
        <strong>${districtB}</strong>
        appears in
        <strong>
            ${biggestDifference.category}
        </strong>.
        It represents
        <strong>
            ${higherValue.toFixed(1)}%
        </strong>
        in ${higherDistrict},
        compared with
        <strong>
            ${lowerValue.toFixed(1)}%
        </strong>
        in ${lowerDistrict}.
    `;


    /* -----------------------------------------------------
       DRAW COMPARISON
       ----------------------------------------------------- */

    const container =
        d3.select(
            "#comparison-chart"
        );


    container
        .selectAll("*")
        .remove();


    const rows = container
        .selectAll(
            ".comparison-row"
        )
        .data(
            comparison
        )
        .join("div")
        .attr(
            "class",
            "comparison-row"
        );


    /* CATEGORY */

    rows
        .append("div")
        .attr(
            "class",
            "comparison-category"
        )
        .text(
            d => d.category
        );


    /* DISTRICT A */

    const aSide = rows
        .append("div")
        .attr(
            "class",
            "comparison-value comparison-value-a"
        );


    aSide
        .append("strong")
        .text(
            d =>
                `${d.a.toFixed(1)}%`
        );


    const aTrack = aSide
        .append("div")
        .attr(
            "class",
            "compare-track"
        );


    aTrack
        .append("div")
        .attr(
            "class",
            "compare-fill compare-fill-a"
        )
        .style(
            "width",
            "0%"
        )
        .transition()
        .duration(650)
        .style(
            "width",
            d =>
                `${Math.min(
                    d.a,
                    100
                )}%`
        );


    /* DISTRICT B */

    const bSide = rows
        .append("div")
        .attr(
            "class",
            "comparison-value comparison-value-b"
        );


    bSide
        .append("strong")
        .text(
            d =>
                `${d.b.toFixed(1)}%`
        );


    const bTrack = bSide
        .append("div")
        .attr(
            "class",
            "compare-track"
        );


    bTrack
        .append("div")
        .attr(
            "class",
            "compare-fill compare-fill-b"
        )
        .style(
            "width",
            "0%"
        )
        .transition()
        .duration(650)
        .style(
            "width",
            d =>
                `${Math.min(
                    d.b,
                    100
                )}%`
        );

}


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeDistrictName(name) {

    return String(
        name || ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


function getMapDistrictName(feature) {

    const props =
        feature.properties || {};


    return (
        props["الاسم"] ||
        props["المنطقة في عجمان"] ||
        props.name ||
        props.Name ||
        "Unknown district"
    )
        .toString()
        .trim();

}


function formatPercentage(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "—";

    }


    return `${number.toFixed(1)}%`;

}

/* =========================================================
   KEY FINDINGS
   ========================================================= */

function drawKeyFindings(data) {

    /* -----------------------------------------------------
       GROUP DATA BY DISTRICT
       ----------------------------------------------------- */

    const districts = d3.group(
        data,
        d => d.district
    );


    /* -----------------------------------------------------
       FINDING 1
       MOST COMMON DOMINANT CATEGORY
       ----------------------------------------------------- */

    const dominantCategories = [];

    districts.forEach((rows, district) => {

        const highest = [...rows]
            .sort(
                (a, b) =>
                    +b.percentage -
                    +a.percentage
            )[0];


        if (highest) {

            dominantCategories.push({
                district,
                category: highest.waste_type,
                percentage: +highest.percentage
            });

        }

    });


    const dominantCounts =
        d3.rollups(
            dominantCategories,
            values => values.length,
            d => d.category
        )
        .sort(
            (a, b) =>
                b[1] - a[1]
        );


    const mostCommonDominant =
        dominantCounts[0];


    if (mostCommonDominant) {

        const [
            category,
            count
        ] = mostCommonDominant;


        document.getElementById(
            "finding-dominant-count"
        ).textContent =
            `${count} / ${districts.size}`;


        document.getElementById(
            "finding-dominant-title"
        ).textContent =
            `${category} leads most often`;


        document.getElementById(
            "finding-dominant-text"
        ).textContent =
            `${category} is the largest recorded waste category in ${count} of the ${districts.size} districts represented in the 2023 dataset.`;

    }


    /* -----------------------------------------------------
       FINDING 2
       HIGHEST SINGLE DISTRICT-CATEGORY SHARE
       ----------------------------------------------------- */

    const highestObservation =
        [...data]
            .filter(
                d =>
                    Number.isFinite(
                        +d.percentage
                    )
            )
            .sort(
                (a, b) =>
                    +b.percentage -
                    +a.percentage
            )[0];


    if (highestObservation) {

        document.getElementById(
            "finding-highest-value"
        ).textContent =
            `${(+highestObservation.percentage).toFixed(1)}%`;


        document.getElementById(
            "finding-highest-title"
        ).textContent =
            highestObservation.waste_type;


        document.getElementById(
            "finding-highest-text"
        ).textContent =
            `${highestObservation.district} records the highest single category share in the district dataset: ${highestObservation.waste_type} at ${(+highestObservation.percentage).toFixed(1)}%.`;

    }


    /* -----------------------------------------------------
       FINDING 3
       CATEGORY WITH LARGEST DISTRICT RANGE
       ----------------------------------------------------- */

    const categories =
        d3.group(
            data,
            d => d.waste_type
        );


    const categoryRanges = [];


    categories.forEach(
        (rows, category) => {

            const validRows =
                rows.filter(
                    d =>
                        Number.isFinite(
                            +d.percentage
                        )
                );


            if (
                validRows.length === 0
            ) {
                return;
            }


            const highest =
                validRows.reduce(
                    (best, row) =>
                        +row.percentage >
                        +best.percentage
                            ? row
                            : best
                );


            const lowest =
                validRows.reduce(
                    (best, row) =>
                        +row.percentage <
                        +best.percentage
                            ? row
                            : best
                );


            categoryRanges.push({

                category,

                highest,

                lowest,

                range:
                    +highest.percentage -
                    +lowest.percentage

            });

        }
    );


    categoryRanges.sort(
        (a, b) =>
            b.range -
            a.range
    );


    const widest =
        categoryRanges[0];


    if (widest) {

        document.getElementById(
            "finding-range-value"
        ).textContent =
            `${widest.range.toFixed(1)}`;


        document.getElementById(
            "finding-range-title"
        ).textContent =
            widest.category;


        document.getElementById(
            "finding-range-text"
        ).textContent =
            `Its recorded share ranges from ${(+widest.lowest.percentage).toFixed(1)}% in ${widest.lowest.district} to ${(+widest.highest.percentage).toFixed(1)}% in ${widest.highest.district} — a spread of ${widest.range.toFixed(1)} percentage points.`;

    }

}

/* =========================================================
   SCROLL REVEAL SYSTEM
   ========================================================= */

function initializeScrollReveals() {

    /* -----------------------------------------------------
       MAIN TEXT / HEADINGS
       ----------------------------------------------------- */

    const revealElements = document.querySelectorAll(`
        .section-heading,
        .methodology-header,
        .closing-content,
        .source-block,
        .methodology-note,
        .story-transition
    `);

    revealElements.forEach(element => {
        element.classList.add("reveal");
    });


    /* -----------------------------------------------------
       CARDS
       ----------------------------------------------------- */

    const cardElements = document.querySelectorAll(`
        .stat-card,
        .method-card,
        .insight-card,
        .compare-summary
    `);

    cardElements.forEach((element, index) => {

        element.classList.add("reveal-card");

        /*
           Small stagger between nearby cards.
        */

        element.style.transitionDelay =
            `${(index % 4) * 90}ms`;

    });


    /* -----------------------------------------------------
       DATA VISUALIZATIONS
       ----------------------------------------------------- */

    const visualElements = document.querySelectorAll(`
        .visual-card,
        .composition-story-layout,
        .district-layout,
        .comparison-card
    `);

    visualElements.forEach(element => {
        element.classList.add("reveal-visual");
    });


    /* -----------------------------------------------------
       INTERSECTION OBSERVER
       ----------------------------------------------------- */

    const observer = new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add(
                    "reveal-visible"
                );

                /*
                   Reveal once only.
                */

                observer.unobserve(
                    entry.target
                );

            });

        },
        {
            threshold: 0.12,
            rootMargin:
                "0px 0px -60px 0px"
        }
    );


    document
        .querySelectorAll(
            ".reveal, .reveal-card, .reveal-visual"
        )
        .forEach(element => {

            observer.observe(element);

        });

}

/* =========================================================
   HERO PARTICLES
   ========================================================= */

function createHeroParticles() {

    const container =
        document.getElementById("hero-particles");

    if (!container) return;

    const particleCount = 38;

    for (let i = 0; i < particleCount; i++) {

        const particle =
            document.createElement("span");

        particle.className =
            "hero-particle";

        particle.style.left =
            `${Math.random() * 100}%`;

        particle.style.top =
            `${Math.random() * 100}%`;

        particle.style.animationDuration =
            `${8 + Math.random() * 12}s`;

        particle.style.animationDelay =
            `${Math.random() * -15}s`;

        particle.style.opacity =
            0.05 + Math.random() * 0.22;

        container.appendChild(particle);

    }

}

createHeroParticles();

/* =========================================================
   PAGE EXPERIENCE
   Scroll reveals + active navigation
   ========================================================= */

function initPageExperience() {

    /* -----------------------------------------------------
       SCROLL REVEALS
       ----------------------------------------------------- */

    const revealElements = document.querySelectorAll(`
        .section-heading,
        .story-stats,
        .visual-card,
        .composition-story-layout,
        .district-layout,
        .compare-controls,
        .compare-summary,
        .comparison-card,
        .comparison-insight,
        .insight-card,
        .method-card,
        .source-row,
        .closing-content
    `);

    revealElements.forEach((element, index) => {
        element.classList.add("reveal");

        // Tiny stagger for elements that appear together
        element.style.setProperty(
            "--reveal-delay",
            `${Math.min(index % 3, 2) * 70}ms`
        );
    });


    const revealObserver = new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("revealed");

                    revealObserver.unobserve(entry.target);

                }

            });

        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -60px 0px"
        }
    );


    revealElements.forEach(element => {
        revealObserver.observe(element);
    });


    /* -----------------------------------------------------
       ACTIVE NAVIGATION
       ----------------------------------------------------- */

    const navLinks =
        [...document.querySelectorAll(".nav-links a")];

    const navTargets = navLinks
        .map(link => {

            const id = link.getAttribute("href");

            if (!id || !id.startsWith("#")) {
                return null;
            }

            const section = document.querySelector(id);

            if (!section) {
                return null;
            }

            return {
                link,
                section
            };

        })
        .filter(Boolean);


    function updateActiveNavigation() {

        const marker =
            window.scrollY + window.innerHeight * 0.35;

        let activeItem = navTargets[0];


        navTargets.forEach(item => {

            if (item.section.offsetTop <= marker) {
                activeItem = item;
            }

        });


        navLinks.forEach(link => {
            link.classList.remove("active");
        });


        if (activeItem) {
            activeItem.link.classList.add("active");
        }

    }


    window.addEventListener(
        "scroll",
        updateActiveNavigation,
        { passive: true }
    );


    updateActiveNavigation();

}


/* Start page experience */

window.addEventListener("load", () => {
    initPageExperience();
});