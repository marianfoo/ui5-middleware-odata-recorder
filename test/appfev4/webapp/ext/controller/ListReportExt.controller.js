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
            const booksModel = this.getView().getModel("books");

            if (!booksModel) {
                console.error("Books model not found");
                return;
            }

            // Load the dialog fragment if not already loaded
            if (!booksDialog) {
                booksDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "appfev4.ext.fragment.BooksDialog",
                    controller: this
                });

                this.getView().addDependent(booksDialog);
            }

            // Set the model on the dialog
            booksDialog.setModel(booksModel, "books");

            // Open the dialog
            booksDialog.open();
        },

        /**
         * Handler for closing the dialog
         */
        onCloseDialog: function() {
            if (booksDialog) {
                booksDialog.close();
            }
        },

        /**
         * Demo: Load an Order with expanded Items navigation
         * This demonstrates the expanded navigation recording feature
         * 
         * Usage:
         * 1. Start recording: http://localhost:8080/__recorder/start
         * 2. Call this function from browser console: 
         *    sap.ui.require(["sap/ui/core/Core"], function(Core) {
         *      Core.byId("appfev4::OrdersList--fe::CustomAction::ShowBooks").firePress();
         *    });
         * 3. The recorder will save both Orders and Orders_Items to separate files
         */
        onLoadOrderWithExpandedItems: async function() {
            try {
                const oModel = this.getView().getModel();
                
                // Load the first order with expanded Items navigation
                const oBinding = oModel.bindContext("/Orders", null, {
                    $top: 1,
                    $expand: "Items"
                });
                
                await oBinding.requestObject();
                const oOrder = oBinding.getBoundContext().getObject();
                
                MessageToast.show(`Loaded Order ${oOrder.OrderNo} with ${oOrder.Items?.length || 0} items (check recorder output)`);
                
                console.log("[Demo] Expanded navigation test - Order with Items:", oOrder);
                console.log("[Demo] Check localService/mainService/data/ for Orders.json and Orders_Items.json");
                
            } catch (error) {
                console.error("[Demo] Error loading order with expanded items:", error);
                MessageToast.show("Error: " + error.message);
            }
        },

        /**
         * Demo: Load multiple Orders with different expand combinations
         * Tests nested and multiple navigation expansions
         */
        onLoadOrdersWithMultipleExpands: async function() {
            try {
                const oModel = this.getView().getModel();
                
                // Load orders with expanded Items and customer
                const oListBinding = oModel.bindList("/Orders", null, null, null, {
                    $top: 2,
                    $expand: "Items,customer"
                });
                
                const aContexts = await oListBinding.requestContexts(0, 2);
                const aOrders = aContexts.map(ctx => ctx.getObject());
                
                MessageToast.show(`Loaded ${aOrders.length} orders with expanded navigations (check recorder output)`);
                
                console.log("[Demo] Multiple expands test - Orders:", aOrders);
                console.log("[Demo] Check localService/mainService/data/ for Orders.json, Orders_Items.json, and Customers.json");
                
            } catch (error) {
                console.error("[Demo] Error loading orders with multiple expands:", error);
                MessageToast.show("Error: " + error.message);
            }
        }
    };
});
