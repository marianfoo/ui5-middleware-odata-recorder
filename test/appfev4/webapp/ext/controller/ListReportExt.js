sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/m/MessageToast"
], function(Fragment, Dialog, MessageToast) {
    "use strict";

    let booksDialog = null;

    return {
        /**
         * Handler for the custom "Show Available Books" button
         */
        onShowBooks: async function() {
            // Get the books model
            const booksModel = this.getEditFlow().getView().getModel("books");

            if (!booksModel) {
                console.error("Books model not found");
                return;
            }

            // Load the dialog fragment if not already loaded
            if (!booksDialog) {
                booksDialog = await Fragment.load({
                    id: this.getEditFlow().getView().getId(),
                    name: "appfev4.ext.fragment.BooksDialog"
                });

                this.getEditFlow().getView().addDependent(booksDialog);

                // Manually attach the close event to the button
                const closeButton = booksDialog.getBeginButton();
                if (closeButton) {
                    closeButton.attachPress(function() {
                        console.log("Close button clicked programmatically");
                        booksDialog.close();
                    });
                }
            }

            // Set the model on the dialog
            booksDialog.setModel(booksModel, "books");

            // Open the dialog
            booksDialog.open();
        },

        /**
         * Demo: Load an Order with expanded Items navigation
         * This demonstrates the expanded navigation recording feature
         * 
         * Usage:
         * 1. Start recording: http://localhost:8080/__recorder/start
         * 2. Click the "Demo: Order + Items" button
         * 3. The recorder will save both Orders and Orders_Items to separate files
         */
        onLoadOrderWithExpandedItems: async function(oEvent) {
            try {
                // Get model from the view via extension API
                const oModel = this.getEditFlow().getView().getModel();
                
                // Load the first order with expanded Items navigation
                // bindList(sPath, oContext, vSorters, vFilters, mParameters)
                const oListBinding = oModel.bindList("/Orders", undefined, undefined, undefined, {
                    $expand: "Items"
                });
                
                // requestContexts(iStart, iLength) - request 1 context starting at index 0
                const aContexts = await oListBinding.requestContexts(0, 1);
                if (aContexts.length === 0) {
                    MessageToast.show("No orders found");
                    return;
                }
                
                const oOrder = aContexts[0].getObject();
                
                console.log("[Demo V4] Expanded navigation test - Order with Items:", oOrder);
                console.log("[Demo V4] Check localService/mainService/data/ for Orders.json and Orders_Items.json");
                
                // Show results in dialog
                const title = "Order with Expanded Items";
                const summary = `Order: ${oOrder.OrderNo || oOrder.ID}\nItems Count: ${oOrder.Items?.length || 0}`;
                const sData = JSON.stringify(oOrder, null, 2);
                
                const oDialog = new Dialog({
                    title: title,
                    contentWidth: "600px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({
                                    text: summary
                                }).addStyleClass("sapUiSmallMarginBottom"),
                                new sap.m.Label({
                                    text: "Full JSON Data:"
                                }).addStyleClass("sapUiTinyMarginTop"),
                                new sap.m.TextArea({
                                    value: sData,
                                    rows: 15,
                                    width: "100%",
                                    editable: false
                                })
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ],
                    beginButton: new sap.m.Button({
                        text: "Close",
                        press: function() {
                            oDialog.close();
                        }
                    }),
                    afterClose: function() {
                        oDialog.destroy();
                    }
                });
                
                oDialog.open();
                
            } catch (error) {
                console.error("[Demo V4] Error loading order with expanded items:", error);
                MessageToast.show("Error: " + error.message);
            }
        },

        /**
         * Demo: Load multiple Orders with different expand combinations
         * Tests nested and multiple navigation expansions
         */
        onLoadOrdersWithMultipleExpands: async function(oEvent) {
            try {
                // Get model from the view via extension API
                const oModel = this.getEditFlow().getView().getModel();
                
                // Load orders with expanded Items and customer
                // bindList(sPath, oContext, vSorters, vFilters, mParameters)
                const oListBinding = oModel.bindList("/Orders", undefined, undefined, undefined, {
                    $expand: "Items,customer"
                });
                
                // requestContexts(iStart, iLength) - request 2 contexts starting at index 0
                const aContexts = await oListBinding.requestContexts(0, 2);
                const aOrders = aContexts.map(ctx => ctx.getObject());
                
                console.log("[Demo V4] Multiple expands test - Orders:", aOrders);
                console.log("[Demo V4] Check localService/mainService/data/ for Orders.json, Orders_Items.json, and Customers.json");
                
                // Build summary
                let summary = `Loaded ${aOrders.length} orders:\n\n`;
                aOrders.forEach((order, idx) => {
                    summary += `Order ${idx + 1}: ${order.OrderNo || order.ID}\n`;
                    summary += `  Items: ${order.Items?.length || 0}\n`;
                    summary += `  Customer: ${order.customer?.name || 'N/A'}\n\n`;
                });
                
                // Show results in dialog
                const title = "Orders with Multiple Expands";
                const sData = JSON.stringify(aOrders, null, 2);
                
                const oDialog = new Dialog({
                    title: title,
                    contentWidth: "600px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({
                                    text: summary
                                }).addStyleClass("sapUiSmallMarginBottom"),
                                new sap.m.Label({
                                    text: "Full JSON Data:"
                                }).addStyleClass("sapUiTinyMarginTop"),
                                new sap.m.TextArea({
                                    value: sData,
                                    rows: 15,
                                    width: "100%",
                                    editable: false
                                })
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ],
                    beginButton: new sap.m.Button({
                        text: "Close",
                        press: function() {
                            oDialog.close();
                        }
                    }),
                    afterClose: function() {
                        oDialog.destroy();
                    }
                });
                
                oDialog.open();
                
            } catch (error) {
                console.error("[Demo V4] Error loading orders with multiple expands:", error);
                MessageToast.show("Error: " + error.message);
            }
        }
    };
});
