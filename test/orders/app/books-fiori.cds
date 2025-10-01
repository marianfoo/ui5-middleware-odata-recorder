using { sap.capire.orders.api.BooksService } from '../srv/orders-service';

// Books annotations
annotate BooksService.Books with @(
	UI: {
		SelectionFields: [ author_ID, genre ],
		LineItem: [
			{Value: title, Label:'Title'},
			{Value: author.name, Label:'Author'},
			{Value: genre, Label:'Genre'},
			{Value: stock, Label:'Stock'},
			{Value: price, Label:'Price'},
		],
		HeaderInfo: {
			TypeName: 'Book',
			TypeNamePlural: 'Books',
			Title: {
				Value: title
			},
			Description: {Value: author.name}
		},
		Facets: [
			{$Type: 'UI.ReferenceFacet', Label: 'Details', Target: '@UI.FieldGroup#Details'},
		],
		FieldGroup#Details: {
			Data: [
				{Value: title},
				{Value: author_ID, Label:'Author'},
				{Value: genre},
				{Value: descr, Label:'Description'},
				{Value: stock},
				{Value: price},
				{Value: currency.code, Label:'Currency'}
			]
		}
	}
) {
	ID @UI.Hidden;
	author @(
		Common.ValueList: {
			CollectionPath: 'Authors',
			Parameters: [
				{ $Type: 'Common.ValueListParameterInOut', LocalDataProperty: author_ID, ValueListProperty: 'ID' },
				{ $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
				{ $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'dateOfBirth' }
			]
		},
		Common.Text: author.name,
		Common.TextArrangement: #TextOnly
	);
};

// Authors annotations
annotate BooksService.Authors with @(
	UI: {
		SelectionFields: [ name ],
		LineItem: [
			{Value: name, Label:'Name'},
			{Value: dateOfBirth, Label:'Born'},
			{Value: dateOfDeath, Label:'Died'},
			{Value: placeOfBirth, Label:'Birthplace'},
		],
		HeaderInfo: {
			TypeName: 'Author',
			TypeNamePlural: 'Authors',
			Title: {
				Value: name
			}
		},
		Facets: [
			{$Type: 'UI.ReferenceFacet', Label: 'Details', Target: '@UI.FieldGroup#Details'},
			{$Type: 'UI.ReferenceFacet', Label: 'Books', Target: 'books/@UI.LineItem'},
		],
		FieldGroup#Details: {
			Data: [
				{Value: name},
				{Value: dateOfBirth},
				{Value: dateOfDeath},
				{Value: placeOfBirth},
				{Value: placeOfDeath}
			]
		}
	}
) {
	ID @UI.Hidden;
};
