// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

// JS exclusive to /cart page
frappe.provide("webshop.webshop.shopping_cart");
var shopping_cart = webshop.webshop.shopping_cart;

$.extend(shopping_cart, {
	show_error: function(title, text) {
		$("#cart-container").html('<div class="msg-box"><h4>' +
			title + '</h4><p class="text-muted">' + text + '</p></div>');
	},
	set_error: function(message){
		$("#cart-error")
			.empty()
			.html(message)
			.toggle(true);
	},
	clear_error: function(){
		$("#cart-error").empty().toggle(false);
	},

	bind_events: function() {
		shopping_cart.bind_place_order();
		shopping_cart.bind_request_quotation();
		shopping_cart.bind_change_qty();
		shopping_cart.bind_remove_cart_item();
		shopping_cart.bind_change_notes();
		shopping_cart.bind_coupon_code();
		shopping_cart.bind_financial_assistance();
		shopping_cart.bind_remove_coupon_code();
		shopping_cart.bind_destination_countries();
	},

	// Currently selected destination countries (source of truth = pills in the DOM)
	get_selected_countries: function() {
		return $("#dc_multiselect .dc-pill").map(function() {
			return $(this).attr("data-country");
		}).get();
	},

	bind_destination_countries: function() {
		const $doc = $(document);

		function esc(s) {
			return $("<div>").text(s == null ? "" : s).html();
		}
		function get_all() {
			try { return JSON.parse($("#dc_all_countries").text() || "[]"); }
			catch (e) { return []; }
		}
		function hide_dropdown() {
			$("#dc_dropdown").attr("hidden", true).empty();
		}
		function clear_invalid() {
			shopping_cart.clear_error();
			$("#dc_multiselect .dc-control").removeClass("is-invalid");
		}
		// persist the current selection to the quotation immediately
		function persist_countries() {
			shopping_cart.shopping_cart_update({
				custom_destination_countries: shopping_cart.get_selected_countries()
			});
		}
		function render_dropdown(term) {
			const selected = shopping_cart.get_selected_countries();
			const t = (term || "").trim().toLowerCase();
			const matches = get_all().filter(c =>
				selected.indexOf(c) === -1 && (!t || c.toLowerCase().indexOf(t) !== -1)
			).slice(0, 50);
			const $dd = $("#dc_dropdown");
			if (!matches.length) {
				$dd.html('<div class="dc-empty">No countries found</div>');
			} else {
				$dd.html(matches.map(c =>
					`<div class="dc-option" data-country="${esc(c)}">${esc(c)}</div>`
				).join(""));
			}
			$dd.removeAttr("hidden");
		}

		// open / filter the dropdown
		$doc.on("focus", "#dc_search", function() { render_dropdown($(this).val()); });
		$doc.on("input", "#dc_search", function() { render_dropdown($(this).val()); });

		// add a country (mousedown so it fires before the input blur/outside-click)
		$doc.on("mousedown", "#dc_dropdown .dc-option", function(e) {
			e.preventDefault();
			const country = $(this).attr("data-country");
			if (country && shopping_cart.get_selected_countries().indexOf(country) === -1) {
				$("#dc_multiselect .dc-pills").append(
					`<span class="dc-pill" data-country="${esc(country)}">${esc(country)}` +
					`<span class="dc-pill-remove" role="button" aria-label="Remove">&times;</span></span>`
				);
				persist_countries();
			}
			clear_invalid();
			const $s = $("#dc_search");
			$s.val("");
			render_dropdown("");
			$s.focus();
		});

		// remove a country
		$doc.on("click", "#dc_multiselect .dc-pill-remove", function() {
			$(this).closest(".dc-pill").remove();
			persist_countries();
		});

		// clicking anywhere on the control focuses the search box
		$doc.on("click", "#dc_multiselect .dc-control", function(e) {
			if (!$(e.target).hasClass("dc-pill-remove")) $("#dc_search").focus();
		});

		// close the dropdown when clicking outside the widget
		$doc.on("mousedown", function(e) {
			if (!$(e.target).closest("#dc_multiselect").length) hide_dropdown();
		});
	},
	bind_financial_assistance: function() {
		$('.payment-summary').on('click','#financial_assistance', function() {
			const value = this.checked;
			shopping_cart.shopping_cart_update({financial_assistance:value});
		});
	},


	bind_place_order: function() {
		$(".btn-place-order").on("click", function() {
			shopping_cart.place_order(this);
		});
	},


	bind_request_quotation: function() {
		$('.place-order').on('click','.btn-request-for-quotation', function() {
			//do some validations first
			const dest_countries = shopping_cart.get_selected_countries();
			const $dest_control = $("#dc_multiselect .dc-control");
			const assistance = $("#financial_assistance");
			const notes =  $("#custom_customer_notes");
			const taxId=  $("#tax_id");
			console.log("request_quotation, dest countries: ",dest_countries," fin asist?" ,assistance.prop("checked"),taxId.val());
			if( ! dest_countries.length){
				shopping_cart.set_error("Final Destination Country not set.")
				$dest_control.toggleClass('is-invalid',true);
				$("#dc_search").focus();
				return;
			}else{
				shopping_cart.clear_error();
				$dest_control.toggleClass('is-invalid',false);
			}

			console.log("request_quotation: past valication");
			shopping_cart.shopping_cart_update({
					financial_assistance: assistance.prop("checked"),
					custom_destination_countries:dest_countries,
					custom_customer_notes:notes.val(),
					tax_id: taxId.val()
			},()=>{
				shopping_cart.request_quotation(this)
					.catch(e =>{
						const ex = e.responseJSON;
						console.error("got exception: ",ex);
						if(ex.exc){
							shopping_cart.unfreeze();
							shopping_cart.set_error(
								(ex.exception || frappe._("Something went wrong!")).replace("frappe.exceptions.",""));
						}

					});
				
			});
		});
	},
	bind_change_qty: function() {
		console.log("GAL bind_change_qty, new version");
		// bind update button
		$(".cart-items").on("change", ".cart-qty", function() {
			var btn = $(this);
			var input = btn.closest('.number-spinner').find('input');
			let notes = input.closest("td").siblings().find(".notes").text().trim();
			var item_code = $(this).attr("data-item-code");
			var name = $(this).attr("data-name");
			var newVal = $(this).val();
			shopping_cart.shopping_cart_update({
				item_code, 
				qty: newVal,
				additional_notes: notes,
				name:name
			});
		});

		$(".cart-items").on('click', '.number-spinner button', function () {
			var btn = $(this),
				input = btn.closest('.number-spinner').find('input'),
				oldValue = input.val().trim(),
				newVal = 0;

			if (btn.attr('data-dir') == 'up') {
				newVal = parseInt(oldValue) + 1;
			} else {
				if (oldValue > 1) {
					newVal = parseInt(oldValue) - 1;
				}
			}
			input.val(newVal);

			let notes = input.closest("td").siblings().find(".notes").text().trim();
			var item_code = input.attr("data-item-code");
			var name = input.attr("data-name");
			shopping_cart.shopping_cart_update({
				item_code,
				qty: newVal,
				additional_notes: notes,
				name:name
			});
		});
	},
	
	bind_change_notes: function() {
		$('.cart-items').on('change', 'textarea', function() {
			const $textarea = $(this);
			const item_code = $textarea.attr('data-item-code');
			const qty = $textarea.closest('tr').find('.cart-qty').val();
			const notes = $textarea.val();
			shopping_cart.shopping_cart_update({
				item_code,
				qty,
				additional_notes: notes
			});
		});
	},
	bind_remove_cart_item: function() {
		$(".cart-items").on("click", ".remove-cart-item", (e) => {
			const $remove_cart_item_btn = $(e.currentTarget);
			var item_code = $remove_cart_item_btn.data("item-code");
			var name = $remove_cart_item_btn.data("name");

			shopping_cart.shopping_cart_update({
				item_code: item_code,
				name: name,
				qty: 0
			});
		});
	},
	

	render_tax_row: function($cart_taxes, doc, shipping_rules) {
		var shipping_selector;
		if(shipping_rules) {
			shipping_selector = '<select class="form-control">' + $.map(shipping_rules, function(rule) {
				return '<option value="' + rule[0] + '">' + rule[1] + '</option>' }).join("\n") +
			'</select>';
		}

		var $tax_row = $(repl('<div class="row">\
			<div class="col-md-9 col-sm-9">\
				<div class="row">\
					<div class="col-md-9 col-md-offset-3">' +
					(shipping_selector || '<p>%(description)s</p>') +
					'</div>\
				</div>\
			</div>\
			<div class="col-md-3 col-sm-3 text-right">\
				<p' + (shipping_selector ? ' style="margin-top: 5px;"' : "") + '>%(formatted_tax_amount)s</p>\
			</div>\
		</div>', doc)).appendTo($cart_taxes);

		if(shipping_selector) {
			$tax_row.find('select option').each(function(i, opt) {
				if($(opt).html() == doc.description) {
					$(opt).attr("selected", "selected");
				}
			});
			$tax_row.find('select').on("change", function() {
				shopping_cart.apply_shipping_rule($(this).val(), this);
			});
		}
	},

	apply_shipping_rule: function(rule, btn) {
		return frappe.call({
			btn: btn,
			type: "POST",
			method: "webshop.webshop.shopping_cart.cart.apply_shipping_rule",
			args: { shipping_rule: rule },
			callback: function(r) {
				if(!r.exc) {
					shopping_cart.render(r.message);
				}
			}
		});
	},

	place_order: function(btn) {
		shopping_cart.freeze();

		return frappe.call({
			type: "POST",
			method: "webshop.webshop.shopping_cart.cart.place_order",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					shopping_cart.unfreeze();
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					window.location.href = '/orders/' + encodeURIComponent(r.message);
				}
			}
		});
	},

	request_quotation: function(btn) {
		shopping_cart.freeze();

		return frappe.call({
			type: "POST",
			method: "webshop.webshop.shopping_cart.cart.request_for_quotation",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					shopping_cart.unfreeze();
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					window.location.href = '/quotations/' + encodeURIComponent(r.message);
				}
			}
		});
	},

	bind_coupon_code: function() {
		$(".bt-coupon").on("click", function() {
			shopping_cart.apply_coupon_code(this);
		});
	},

	apply_coupon_code: function(btn) {
		return frappe.call({
			type: "POST",
			method: "webshop.webshop.shopping_cart.cart.apply_coupon_code",
			btn: btn,
			args : {
				applied_code : $('.txtcoupon').val(),
				applied_referral_sales_partner: $('.txtreferral_sales_partner').val()
			},
			callback: function(r) {
				if (r && r.message){
					location.reload();
				}
			}
		});
	},

	bind_remove_coupon_code: function() {
		$(".bt-remove-coupon-code").on("click", function() {
			shopping_cart.remove_coupon_code(this);
		});
	},
	remove_coupon_code: function(btn) {
		return frappe.call({
			type: "POST",
			method: "webshop.webshop.shopping_cart.cart.remove_coupon_code",
			btn: btn,
			callback: function(r) {
				if (r && r.message){
					location.reload();
				}
			}
		});
	},
});

frappe.ready(function() {
	if (window.location.pathname === "/cart") {
		$(".cart-icon").hide();
	}
	shopping_cart.parent = $(".cart-container");
	shopping_cart.bind_events();
});

function show_terms() {
	var html = $(".cart-terms").html();
	frappe.msgprint(html);
}
