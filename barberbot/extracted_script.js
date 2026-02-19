function generateUrl() {
		var clientId = $('#clientId').val().trim();
		var redirectUrl = $('#redirectUrl').val().trim();

		if (!validateUrl(redirectUrl)) {
			$('#urlError').show();
			$('#redirectUrl').closest('.form-group').addClass('has-error');
			$('#redirect-url-output').text("Zadejte platnou URL adresu");
			return;
		}