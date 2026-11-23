const iconsByField = new Map(
  Object.entries({
    factory: 'tozeret_nm tozar_manoa shilda_totzar_en_nm shem_yevuan',
    tag: 'kinuy_mishari degem_nm degem_manoa ramat_gimur sug_rechev_nm sug_tzama_nm',
    'calendar-days':
      'shnat_yitzur moed_aliya_lakvish mivchan_acharon_dt rishum_rishon_dt rishum_date taarich_hatkana',
    palette: 'tzeva_rechev shnui_zeva_ind',
    globe: 'sug_yevu tozeret_eretz_nm production_country',
    fingerprint: 'misgeret mispar_shilda shilda mispar_manoa',
    'file-badge': 'horaat_rishum sug_tkina_nm tkina_EU sug_rechev_EU_cd',
    wallet: 'mehir kvuzat_agra_cd',
    fuel: 'sug_delek_nm gapam_ind',
    zap: 'koah_sus hespek PropulsionType_nm technologiat_hanaa_nm',
    'battery-charging': 'dg_metach_solela',
    weight:
      'mishkal_kolel mishkal_azmi mishkal_ton kosher_harama_ton kod_omes_tzmig_kidmi kod_omes_tzmig_ahori',
    caravan: 'grira_nm kosher_grira_im_blamim kosher_grira_bli_blamim',
    armchair: 'mispar_moshavim SeatsNum mispar_mekomot_leyd_nahag',
    'door-open': 'mispar_dlatot',
    package: 'argaz_ind merkav',
    'air-vent': 'mazgan_ind mispar_kariot_avir',
    camera: 'matzlemat_reverse_ind zihuy_beshetah_nistar_ind',
    waypoints:
      'hanaa_nm bakarat_stiya_menativ_ind bakarat_stiya_activ_s bakarat_yatzivut_ind',
    'scan-line':
      'nitur_merhak_milfanim_ind hayshaney_hagorot_ind hayshaney_lahatz_avir_batzmigim_ind',
    'traffic-cone': 'zihuy_tamrurey_tnua_ind bakarat_mehirut_isa',
    lightbulb: 'shlita_automatit_beorot_gvohim_ind',
    'person-standing':
      'zihuy_holchey_regel_ind blimat_hirum_lifnei_holhei_regel_ofanaim',
    'shield-alert':
      'bitul_nm hagbala_nm_1 hagbala_nm_2 zihuy_matzav_hitkarvut_mesukenet_ind hitnagshut_cad_shetah_met',
    wind: 'kamut_CO2_WLTP kamut_CO2 kamut_NOX kamut_PM10 kamut_CO2_city kamut_CO2_hway sug_mamir_nm',
    users: 'baalut mkoriut_nm mispar_yad_nochichi operator_nm',
    gauge:
      'total_kilometer kilometer_test_aharon bakarat_shyut_adaptivit_ind kod_mehirut_tzmig_kidmi kod_mehirut_tzmig_ahori',
  }).flatMap(([icon, fields]) =>
    fields.split(' ').map((field) => [field, icon] as const),
  ),
);

export function fieldIcon(field: string, fallback: string) {
  return iconsByField.get(field) ?? fallback;
}
