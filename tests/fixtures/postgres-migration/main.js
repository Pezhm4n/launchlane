import React from "react";
document.querySelector("#root").dataset.runtime = React.version;
fetch("/api/entry").then(response => response.json()).then(row => { document.querySelector("#root").textContent = `Migration lifecycle: ${row.label}`; });
