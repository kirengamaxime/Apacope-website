/* School details printed on report cards. Override any of them with environment variables. */
module.exports = {
  name: process.env.SCHOOL_NAME || 'Groupe Scolaire APACOPE',
  motto: process.env.SCHOOL_MOTTO || 'Technical education that gets learners ready for work',
  address: process.env.SCHOOL_ADDRESS || '',
  phone: process.env.SCHOOL_PHONE || '',
  email: process.env.SCHOOL_EMAIL || '',
  logo: require('path').join(__dirname, '..', 'assets', 'logo.png'),
};