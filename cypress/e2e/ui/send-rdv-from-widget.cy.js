describe("send-rdv-from-widget", () => {
  it("tests send-rdv-from-widget", () => {
    cy.viewport(1271, 721);
    cy.visit("https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage-formation");
    cy.get("form > div > div.css-0 input").click();
    cy.get("form > div > div.css-0 input").type("esth");
    cy.get("#lang-switcher-item-0").click();
    cy.get("div.css-iiltjv div.css-0 img").click();
    cy.get("a:nth-of-type(1) div.css-17xle36").click();
    cy.get("header a").click();
    cy.get("form > input:nth-of-type(1)").click();
    cy.get("form > input:nth-of-type(1)").type("John");
    cy.get("form > input.css-jw8yg").click();
    cy.get("form > input.css-jw8yg").type("Doe");
    cy.get("div.css-0 > input").click();
    cy.get("div.css-0 > input").type("0700000000");
    cy.get("input[type='email']").click();
    cy.get("input[type='email']").type("test-auto@nexistepas.fr");
    cy.get("label:nth-of-type(2) > span.chakra-checkbox__control").click();
    cy.get("label:nth-of-type(4) > span.chakra-checkbox__control").click();
    cy.get("label:nth-of-type(11) > span.chakra-checkbox__control").click();
    cy.get("input:nth-of-type(4)").click();
    cy.get("input:nth-of-type(4)").type("horaires");
    cy.get("button").click();
  });
});
//# recorderSourceMap=BCBDBEAEAEAEBFBGBHBIBJAJBKBLBMBNBOBPBQBRBSBTBUBVBWBXAXBYA
